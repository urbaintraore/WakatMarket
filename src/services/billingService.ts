import { jsPDF } from "jspdf";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/firebase";
import { supabase } from "../supabase";

// Définition des types pour la facture
interface LigneFacture {
  produitId: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

interface FactureData {
  venteId: string;
  vendeurId: string;
  vendeurNom: string;
  vendeurRole: string; // Grossiste, Demi-Grossiste, Détaillant
  acheteurId?: string;
  acheteurNom?: string;
  lignes: LigneFacture[];
  total: number;
  typeVente: "GROS" | "DETAIL";
}

/**
 * Service pour la génération et l'enregistrement des factures
 */
export const billingService = {
  /**
   * Génère un numéro de facture unique (ex: GRO-2026-0001)
   */
  generateFactureNumber(role: string): string {
    const prefix = (role || "VENTE").substring(0, 3).toUpperCase();
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `${prefix}-${year}-${randomSeq}`;
  },

  /**
   * Génère le PDF de la facture, l'enregistre/télécharge immédiatement et synchronise en arrière-plan
   */
  async genererEtEnregistrerFacture(data: FactureData): Promise<string> {
    try {
      // 1. Initialiser jsPDF
      const doc = new jsPDF();
      const numeroFacture = this.generateFactureNumber(data.vendeurRole || "VENTE");
      
      // Configuration de base
      let y = 20;
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("WakatMarket - Facture Officielle", 105, y, { align: "center" });
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Plateforme de Distribution & Ventes Directes", 105, y, { align: "center" });
      
      y += 15;
      doc.setFontSize(11);
      doc.text(`Facture N°: ${numeroFacture}`, 20, y);
      doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}`, 120, y);
      
      y += 8;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, 190, y);

      y += 12;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Informations Vendeur", 20, y);
      doc.text("Informations Acheteur", 110, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Nom: ${data.vendeurNom}`, 20, y);
      doc.text(`Profil: ${data.vendeurRole}`, 20, y + 6);
      doc.text(`Type de vente: ${data.typeVente || 'DIRECT'}`, 20, y + 12);
      
      doc.text(`Nom: ${data.acheteurNom || 'Client Final (Comptoir)'}`, 110, y);
      doc.text(`ID: ${data.acheteurId || 'N/A'}`, 110, y + 6);
      
      y += 28;
      doc.line(20, y, 190, y);

      y += 10;
      // En-têtes du tableau
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Produit", 20, y);
      doc.text("Qté", 110, y);
      doc.text("Prix U.", 135, y);
      doc.text("Sous-Total", 165, y);
      
      // Ligne de séparation
      y += 3;
      doc.line(20, y, 190, y);
      
      y += 8;
      doc.setFont("helvetica", "normal");
      
      // Lignes de produits
      (data.lignes || []).forEach((ligne) => {
        const name = (ligne.nom || "Produit").substring(0, 42);
        const qty = (ligne.quantite || 0).toString();
        const pu = `${(ligne.prixUnitaire || 0).toLocaleString('fr-FR')} CFA`;
        const st = `${(ligne.sousTotal || (ligne.quantite * ligne.prixUnitaire) || 0).toLocaleString('fr-FR')} CFA`;
        
        doc.text(name, 20, y);
        doc.text(qty, 110, y);
        doc.text(pu, 135, y);
        doc.text(st, 165, y);
        y += 8;
      });
      
      y += 4;
      doc.line(20, y, 190, y);
      
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`TOTAL NET: ${(data.total || 0).toLocaleString('fr-FR')} FCFA`, 110, y);

      y += 20;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text("Facture certifiée • Générée automatiquement via WakatMarket", 105, y, { align: "center" });

      // 2. Génération immédiate du Blob et URL local
      const pdfBlob = doc.output("blob");
      const localUrl = URL.createObjectURL(pdfBlob);

      // 3. Auto-téléchargement immédiat
      try {
        doc.save(`Facture_${numeroFacture}.pdf`);
      } catch (saveError) {
        console.warn("Auto save PDF browser error:", saveError);
      }

      // 4. Exécution asynchrone non-bloquante du stockage réseau
      (async () => {
        let urlPDF = localUrl;
        try {
          if (supabase) {
            const filePath = `factures/${data.vendeurId || 'sales'}/${numeroFacture}.pdf`;
            const { error } = await supabase.storage
              .from('chat')
              .upload(filePath, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
              });
            if (!error) {
              const { data: publicUrlData } = supabase.storage
                .from('chat')
                .getPublicUrl(filePath);
              if (publicUrlData?.publicUrl) {
                urlPDF = publicUrlData.publicUrl;
              }
            }
          }
        } catch (stErr) {
          console.warn("Supabase upload warn:", stErr);
        }

        // Fallback to Firebase Storage if urlPDF is still local
        if (urlPDF === localUrl && storage) {
          try {
            const storageRef = ref(storage, `factures/${data.vendeurId || 'sales'}/${numeroFacture}.pdf`);
            await uploadBytes(storageRef, pdfBlob, { contentType: 'application/pdf' });
            urlPDF = await getDownloadURL(storageRef);
          } catch (fbErr) {
            console.warn("Firebase Storage upload warn for PDF:", fbErr);
          }
        }

        try {
          const db = getFirestore();
          await addDoc(collection(db, "factures"), {
            venteId: data.venteId,
            numeroFacture,
            urlPDF,
            vendeurId: data.vendeurId,
            acheteurId: data.acheteurId || null,
            total: data.total,
            dateEmission: serverTimestamp()
          });
        } catch (dbErr) {
          console.warn("Firestore save warn (app running in local mode):", dbErr);
        }
      })();

      return localUrl;
    } catch (error) {
      console.error("Erreur lors de la génération de la facture:", error);
      throw new Error("Impossible de générer la facture.");
    }
  }
};
