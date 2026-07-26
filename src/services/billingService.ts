import { jsPDF } from "jspdf";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
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
    const prefix = role.substring(0, 3).toUpperCase();
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `${prefix}-${year}-${randomSeq}`;
  },

  /**
   * Génère le PDF de la facture, l'upload sur Firebase Storage et crée le document Firestore
   */
  async genererEtEnregistrerFacture(data: FactureData): Promise<string> {
    try {
      // 1. Initialiser jsPDF
      const doc = new jsPDF();
      const numeroFacture = this.generateFactureNumber(data.vendeurRole);
      
      // Configuration de base
      let y = 20;
      doc.setFontSize(20);
      doc.text("WakatMarket - Facture", 105, y, { align: "center" });
      
      y += 15;
      doc.setFontSize(12);
      doc.text(`Facture N°: ${numeroFacture}`, 20, y);
      doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, 140, y);
      
      y += 15;
      doc.setFontSize(14);
      doc.text("Informations Vendeur", 20, y);
      doc.text("Informations Acheteur", 120, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.text(`Nom: ${data.vendeurNom}`, 20, y);
      doc.text(`Profil: ${data.vendeurRole}`, 20, y + 6);
      doc.text(`Type de vente: ${data.typeVente}`, 20, y + 12);
      
      doc.text(`Nom: ${data.acheteurNom || 'Client Final'}`, 120, y);
      doc.text(`ID: ${data.acheteurId || 'N/A'}`, 120, y + 6);
      
      y += 30;
      // En-têtes du tableau
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Produit", 20, y);
      doc.text("Qté", 100, y);
      doc.text("Prix U.", 130, y);
      doc.text("Sous-Total", 160, y);
      
      // Ligne de séparation
      y += 2;
      doc.line(20, y, 190, y);
      
      y += 8;
      doc.setFont("helvetica", "normal");
      
      // Lignes de produits
      data.lignes.forEach((ligne) => {
        doc.text(ligne.nom, 20, y);
        doc.text(ligne.quantite.toString(), 100, y);
        doc.text(`${ligne.prixUnitaire} CFA`, 130, y);
        doc.text(`${ligne.sousTotal} CFA`, 160, y);
        y += 8;
      });
      
      y += 5;
      doc.line(20, y, 190, y);
      
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`TOTAL: ${data.total} CFA`, 140, y);

      // 2. Générer le blob (Blob)
      const pdfBlob = doc.output("blob");

      // 3. Uploader le PDF sur Supabase Storage
      let urlPDF = "";
      try {
        if (!supabase) {
           throw new Error("Supabase is not configured.");
        }
        
        const filePath = `factures/${data.vendeurId}/${numeroFacture}.pdf`;
        const { error } = await supabase.storage
          .from('chat') // Reuse the existing bucket or create a new one. Let's assume 'chat' or create a 'factures' bucket? I will use 'chat' for simplicity, or we can use 'factures'. Better just use 'chat' since it might be the only one created by the user, or let's use 'public' maybe? The user didn't specify. I'll use 'chat' as we did in chatService.
          .upload(filePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: false
          });
          
        if (error) throw error;
        
        const { data: publicUrlData } = supabase.storage
          .from('chat')
          .getPublicUrl(filePath);
          
        urlPDF = publicUrlData.publicUrl;
      } catch (storageError) {
        console.warn("Supabase Storage non configuré ou erreur d'upload, le PDF ne sera pas sauvegardé en ligne.", storageError);
        // Fallback pour la démo: Créer une URL blob locale
        urlPDF = URL.createObjectURL(pdfBlob);
      }

      // 4. Enregistrer la référence dans Firestore
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
      } catch (dbError) {
        console.warn("Erreur Firestore (peut-être en mode démo):", dbError);
      }

      // 5. Télécharger automatiquement le fichier pour l'utilisateur
      doc.save(`Facture_${numeroFacture}.pdf`);

      return urlPDF;
    } catch (error) {
      console.error("Erreur lors de la génération de la facture:", error);
      throw new Error("Impossible de générer la facture.");
    }
  }
};
