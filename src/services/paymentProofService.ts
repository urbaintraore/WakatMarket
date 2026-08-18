import { billingService } from "./billingService";
import { OrderStatus } from "../types";
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
   * 1. Téléverse la capture d'écran vers Supabase Storage (MonBucket)
   * et met à jour le statut du paiement dans Supabase PostgreSQL
   */
  async uploadPreuvePaiement({
    venteId,
    file,
    vendeurId,
    acheteurId,
    totalAmount,
    acheteurNom
  }: PreuvePaiementParams): Promise<string> {
    if (!supabase) {
      throw new Error("Supabase Storage n'est pas initialisé pour téléverser la preuve de paiement.");
    }

    const timestamp = Date.now();
    const extension = file instanceof File && file.name ? file.name.split(".").pop() : "jpg";
    const storagePath = `preuves-paiement/${venteId}/${timestamp}.${extension}`;
    const storageBucket = "MonBucket";

    const res = await uploadToSupabaseStorage(storageBucket, storagePath, file, file.type || "image/jpeg");
    if (!res?.publicUrl) {
      throw new Error("Échec de la récupération du lien public Supabase pour la preuve de paiement.");
    }
    const downloadUrl = res.publicUrl;

    // Mise à jour de la commande dans PostgreSQL
    const updateData = {
      statut_paiement: "preuve_soumise",
      payment_proof_url: downloadUrl,
      payment_proof_storage_path: storagePath,
      updated_at: new Date().toISOString()
    };

    try {
      await supabase.from("orders").update(updateData).eq("id", venteId);
    } catch (e) {
      console.warn("Notice update order proof:", e);
    }

    // Notifier le vendeur
    if (vendeurId) {
      try {
        const clientLabel = acheteurNom || "L'acheteur";
        await supabase.from("notifications").insert({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          user_id: vendeurId,
          title: "Preuve de paiement soumise",
          type: "preuve_paiement_a_valider",
          read: false,
          metadata: {
            venteId,
            orderId: venteId,
            expediteurId: acheteurId,
            preuvePaiementUrl: downloadUrl
          },
          message: `${clientLabel} a soumis une capture de paiement pour la commande (Montant : ${totalAmount.toLocaleString("fr-FR")} FCFA). Veuillez la vérifier.`
        });
      } catch (notifErr) {
        console.warn("Notice notif creation:", notifErr);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
    }

    return downloadUrl;
  },

  /**
   * 2. Valider le paiement (par le vendeur)
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
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    // 1. Mise à jour de la commande dans Supabase PostgreSQL
    const updatePayload = {
      statut_paiement: "valide",
      payment_status: "PAID",
      amount_paid: totalAmount,
      status: OrderStatus.CONFIRMED,
      updated_at: new Date().toISOString()
    };

    try {
      await supabase.from("orders").update(updatePayload).eq("id", venteId);
    } catch (e) {
      console.warn("Notice update order validation:", e);
    }

    // 2. Génération et enregistrement de la Facture PDF officielle
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

    // 3. Notification pour l'acheteur
    if (acheteurId && acheteurId !== "CLIENT_ANONYME") {
      try {
        const sellerLabel = vendeurNom || "Le vendeur";
        await supabase.from("notifications").insert({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          user_id: acheteurId,
          title: "Paiement validé",
          type: "paiement_valide",
          read: false,
          metadata: {
            venteId,
            orderId: venteId,
            expediteurId: vendeurId,
            factureUrl
          },
          message: `Votre paiement de ${totalAmount.toLocaleString("fr-FR")} FCFA a été validé avec succès par ${sellerLabel}. Votre facture officielle est prête.`
        });
      } catch (notifErr) {
        console.warn("Notice notif creation:", notifErr);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
    }

    return { success: true, factureUrl };
  },

  /**
   * 3. Rejeter la preuve de paiement (par le vendeur)
   */
  async rejeterPaiementVente({
    venteId,
    vendeurId,
    acheteurId,
    commentaire,
    vendeurNom
  }: RejetPaiementParams): Promise<{ success: boolean }> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    const cleanComment = commentaire.trim() || "Preuve non conforme ou montant incorrect.";

    const updatePayload = {
      statut_paiement: "rejete",
      rejection_reason: cleanComment,
      updated_at: new Date().toISOString()
    };

    try {
      await supabase.from("orders").update(updatePayload).eq("id", venteId);
    } catch (e) {
      console.warn("Notice update order rejection:", e);
    }

    // Notification pour l'acheteur
    if (acheteurId && acheteurId !== "CLIENT_ANONYME") {
      try {
        const sellerLabel = vendeurNom || "Le vendeur";
        await supabase.from("notifications").insert({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          user_id: acheteurId,
          title: "Preuve de paiement rejetée",
          type: "paiement_rejete",
          read: false,
          metadata: {
            venteId,
            orderId: venteId,
            expediteurId: vendeurId,
            commentaire: cleanComment
          },
          message: `${sellerLabel} a rejeté votre preuve de paiement. Motif : "${cleanComment}". Veuillez vérifier votre transaction et soumettre une nouvelle capture.`
        });
      } catch (notifErr) {
        console.warn("Notice notif rejection:", notifErr);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
    }

    return { success: true };
  }
};
