import { db, storage, functions } from "../firebase/firebase";
import { 
  doc, 
  setDoc, 
  updateDoc, 
  collection, 
  serverTimestamp, 
  addDoc, 
  onSnapshot, 
  query, 
  where 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { billingService } from "./billingService";
import { Order, OrderStatus } from "../types";
import { supabase, uploadToSupabaseStorage } from "../supabase";

export interface PreuvePaiementParams {
  venteId: string;
  file: File | Blob;
  vendeurId: string;
  acheteurId: string;
  totalAmount: number;
  vendeurNom?: string;
  acheteurNom?: string;
}

export interface ValidationPaiementParams {
  venteId: string;
  vendeurId: string;
  acheteurId: string;
  totalAmount: number;
  vendeurNom?: string;
  vendeurRole?: string;
  acheteurNom?: string;
  lignes?: any[];
  typeVente?: "GROS" | "DETAIL";
}

export interface RejetPaiementParams {
  venteId: string;
  vendeurId: string;
  acheteurId: string;
  commentaire: string;
  vendeurNom?: string;
}

export const paymentProofService = {
  /**
   * 1. Téléverse la capture d'écran vers Supabase Storage (Bucket 2)
   * et met à jour le statut du paiement à 'preuve_soumise' dans Firestore
   */
  async uploadPreuvePaiement({
    venteId,
    file,
    vendeurId,
    acheteurId,
    totalAmount,
    acheteurNom
  }: PreuvePaiementParams): Promise<string> {
    let downloadUrl = "";
    const timestamp = Date.now();
    const extension = file instanceof File && file.name ? file.name.split('.').pop() : 'jpg';
    const storagePath = `preuves-paiement/${venteId}/${timestamp}.${extension}`;
    let storageBucket = "Bucket 2";

    // 1. Upload physique prioritaire vers Supabase Storage
    if (supabase) {
      try {
        const res = await uploadToSupabaseStorage("Bucket 2", storagePath, file, file.type || "image/jpeg");
        if (res?.publicUrl) {
          downloadUrl = res.publicUrl;
        }
      } catch (supErr) {
        console.warn("Supabase Storage upload warning for payment proof:", supErr);
      }
    }

    // Fallback Firebase Storage
    if (!downloadUrl && storage) {
      try {
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || "image/jpeg",
          customMetadata: {
            venteId,
            acheteurId,
            vendeurId,
            total: String(totalAmount)
          }
        });
        downloadUrl = await getDownloadURL(storageRef);
        storageBucket = "firebase";
      } catch (storageError) {
        console.warn("Firebase Storage fallback upload notice:", storageError);
      }
    }

    if (!downloadUrl) {
      throw new Error("Échec du téléversement de la preuve de paiement sur le Cloud.");
    }

    const now = serverTimestamp();

    // 2. Mettre à jour /ventes/{venteId} et /orders/{venteId} dans Firestore
    const updateData = {
      statutPaiement: "preuve_soumise",
      preuvePaiementUrl: downloadUrl,
      preuvePaiementStoragePath: storagePath,
      preuvePaiementBucket: storageBucket,
      dateSoumissionPreuve: now,
      commentaireRejet: null,
      updatedAt: new Date().toISOString()
    };

    try {
      const venteRef = doc(db, "ventes", venteId);
      await updateDoc(venteRef, updateData).catch(async () => {
        await setDoc(venteRef, updateData, { merge: true });
      });
    } catch (e) {
      console.warn("Error updating ventes document:", e);
    }

    try {
      const orderRef = doc(db, "orders", venteId);
      await updateDoc(orderRef, updateData).catch(async () => {
        await setDoc(orderRef, updateData, { merge: true });
      });
    } catch (e) {
      console.warn("Error updating orders document:", e);
    }

    // 3. Notifier le vendeur dans /notifications/{vendeurId}/items/{notifId}
    if (vendeurId) {
      try {
        const notifRef = doc(collection(db, "notifications", vendeurId, "items"));
        const clientLabel = acheteurNom || "L'acheteur";
        await setDoc(notifRef, {
          type: "preuve_paiement_a_valider",
          venteId,
          orderId: venteId,
          expediteurId: acheteurId,
          lu: false,
          dateCreation: now,
          contenu: `${clientLabel} a soumis une capture de paiement pour la commande (Montant : ${totalAmount.toLocaleString("fr-FR")} FCFA). Veuillez la vérifier.`
        });
      } catch (notifErr) {
        console.warn("Error creating notification for seller:", notifErr);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
    }

    return downloadUrl;
  },

  /**
   * 2. Valider le paiement (par le vendeur)
   * Déclenche la génération de facture PDF et notifie l'acheteur
   */
  async validerPaiementVente({
    venteId,
    vendeurId,
    acheteurId,
    totalAmount,
    vendeurNom,
    vendeurRole,
    acheteurNom,
    lignes,
    typeVente
  }: ValidationPaiementParams): Promise<{ success: boolean; factureUrl?: string }> {
    // 1. Appel Cloud Function si disponible
    try {
      if (functions) {
        const validerFn = httpsCallable(functions, "validerPaiementVente");
        await validerFn({ venteId });
      }
    } catch (cfErr) {
      console.warn("Cloud function validerPaiementVente call fallback to direct Firestore:", cfErr);
    }

    const now = serverTimestamp();

    // 2. Mise à jour Firestore directe
    const updatePayload = {
      statutPaiement: "valide",
      dateValidationPaiement: now,
      statut: "VALIDE",
      paymentStatus: "PAID",
      amountPaid: totalAmount,
      status: OrderStatus.CONFIRMED,
      updatedAt: new Date().toISOString()
    };

    try {
      const venteRef = doc(db, "ventes", venteId);
      await updateDoc(venteRef, updatePayload).catch(async () => {
        await setDoc(venteRef, updatePayload, { merge: true });
      });
    } catch (e) {
      console.warn("Error updating vente validation in Firestore:", e);
    }

    try {
      const orderRef = doc(db, "orders", venteId);
      await updateDoc(orderRef, updatePayload).catch(async () => {
        await setDoc(orderRef, updatePayload, { merge: true });
      });
    } catch (e) {
      console.warn("Error updating order validation in Firestore:", e);
    }

    // 3. Génération et enregistrement de la Facture PDF officielle
    let factureUrl = "";
    try {
      factureUrl = await billingService.genererEtEnregistrerFacture({
        venteId,
        vendeurId,
        vendeurNom: vendeurNom || "Vendeur WakatMarket",
        vendeurRole: vendeurRole || "GROSSISTE",
        acheteurId,
        acheteurNom: acheteurNom || "Partenaire / Client",
        lignes: lignes && lignes.length > 0 ? lignes : [
          {
            produitId: "PROD-GEN",
            nom: "Articles commandés",
            quantite: 1,
            prixUnitaire: totalAmount,
            sousTotal: totalAmount
          }
        ],
        total: totalAmount,
        typeVente: typeVente || "GROS"
      });
    } catch (factureErr) {
      console.warn("Facture generation warning:", factureErr);
    }

    // 4. Notification pour l'acheteur dans /notifications/{acheteurId}/items
    if (acheteurId && acheteurId !== "CLIENT_ANONYME") {
      try {
        const notifRef = doc(collection(db, "notifications", acheteurId, "items"));
        const sellerLabel = vendeurNom || "Le vendeur";
        await setDoc(notifRef, {
          type: "paiement_valide",
          venteId,
          orderId: venteId,
          expediteurId: vendeurId,
          factureUrl,
          lu: false,
          dateCreation: now,
          contenu: `Votre paiement de ${totalAmount.toLocaleString("fr-FR")} FCFA a été validé avec succès par ${sellerLabel}. Votre facture officielle est prête.`
        });
      } catch (notifErr) {
        console.warn("Error creating buyer notification for validation:", notifErr);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
    }

    return { success: true, factureUrl };
  },

  /**
   * 3. Rejeter la preuve de paiement (par le vendeur avec un motif)
   */
  async rejeterPaiementVente({
    venteId,
    vendeurId,
    acheteurId,
    commentaire,
    vendeurNom
  }: RejetPaiementParams): Promise<{ success: boolean }> {
    // 1. Appel Cloud Function si disponible
    try {
      if (functions) {
        const rejeterFn = httpsCallable(functions, "rejeterPaiementVente");
        await rejeterFn({ venteId, commentaire });
      }
    } catch (cfErr) {
      console.warn("Cloud function rejeterPaiementVente call fallback to direct Firestore:", cfErr);
    }

    const now = serverTimestamp();
    const cleanComment = commentaire.trim() || "Preuve non conforme ou montant incorrect.";

    const updatePayload = {
      statutPaiement: "rejete",
      commentaireRejet: cleanComment,
      dateRejetPaiement: now,
      updatedAt: new Date().toISOString()
    };

    try {
      const venteRef = doc(db, "ventes", venteId);
      await updateDoc(venteRef, updatePayload).catch(async () => {
        await setDoc(venteRef, updatePayload, { merge: true });
      });
    } catch (e) {
      console.warn("Error updating vente rejection in Firestore:", e);
    }

    try {
      const orderRef = doc(db, "orders", venteId);
      await updateDoc(orderRef, updatePayload).catch(async () => {
        await setDoc(orderRef, updatePayload, { merge: true });
      });
    } catch (e) {
      console.warn("Error updating order rejection in Firestore:", e);
    }

    // 2. Notification pour l'acheteur
    if (acheteurId && acheteurId !== "CLIENT_ANONYME") {
      try {
        const notifRef = doc(collection(db, "notifications", acheteurId, "items"));
        const sellerLabel = vendeurNom || "Le vendeur";
        await setDoc(notifRef, {
          type: "paiement_rejete",
          venteId,
          orderId: venteId,
          expediteurId: vendeurId,
          lu: false,
          dateCreation: now,
          contenu: `${sellerLabel} a rejeté votre preuve de paiement. Motif : "${cleanComment}". Veuillez vérifier votre transaction et soumettre une nouvelle capture.`
        });
      } catch (notifErr) {
        console.warn("Error creating buyer notification for rejection:", notifErr);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
    }

    return { success: true };
  }
};
