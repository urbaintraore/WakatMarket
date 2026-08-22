import { jsPDF } from "jspdf";
import { supabase, uploadToSupabaseStorage } from "../supabase";

// Définition des types pour la facture
export interface LigneFacture {
  produitId: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

export interface FactureData {
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
 * Service pour la génération et l'enregistrement des factures via Supabase
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
   * Génère le PDF de la facture, l'enregistre et l'uploade vers Supabase Storage
   */
  async genererEtEnregistrerFacture(data: FactureData): Promise<string> {
    try {
      // 1. Initialiser jsPDF
      const doc = new jsPDF();
      const numeroFacture = this.generateFactureNumber(data.vendeurRole || "VENTE");
      
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
      doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`, 120, y);
      
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
      doc.text(`Type de vente: ${data.typeVente || "DIRECT"}`, 20, y + 12);
      
      doc.text(`Nom: ${data.acheteurNom || "Client Final (Comptoir)"}`, 110, y);
      doc.text(`ID: ${data.acheteurId || "N/A"}`, 110, y + 6);
      
      y += 28;
      doc.line(20, y, 190, y);

      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Produit", 20, y);
      doc.text("Qté", 110, y);
      doc.text("Prix U.", 135, y);
      doc.text("Sous-Total", 165, y);
      
      y += 3;
      doc.line(20, y, 190, y);
      
      y += 8;
      doc.setFont("helvetica", "normal");
      
      (data.lignes || []).forEach((ligne) => {
        const name = (ligne.nom || "Produit").substring(0, 42);
        const qty = (ligne.quantite || 0).toString();
        const pu = `${(ligne.prixUnitaire || 0).toLocaleString("fr-FR")} CFA`;
        const st = `${(ligne.sousTotal || (ligne.quantite * ligne.prixUnitaire) || 0).toLocaleString("fr-FR")} CFA`;
        
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
      doc.text(`TOTAL NET: ${(data.total || 0).toLocaleString("fr-FR")} FCFA`, 110, y);

      y += 20;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text("Facture certifiée • Générée automatiquement via WakatMarket", 105, y, { align: "center" });

      // 2. Génération du Blob PDF
      const pdfBlob = doc.output("blob");

      // 3. Téléchargement immédiat
      try {
        doc.save(`Facture_${numeroFacture}.pdf`);
      } catch (saveError) {
        console.warn("Auto save PDF browser notice:", saveError);
      }

      // 4. Upload Supabase Storage (MonBucket)
      let urlPDF: string | null = null;
      const storagePath = `factures/${data.vendeurId || "sales"}/${numeroFacture}.pdf`;
      const storageBucket = "MonBucket";

      if (supabase) {
        try {
          const res = await uploadToSupabaseStorage(storageBucket, storagePath, pdfBlob, "application/pdf");
          if (res?.publicUrl) {
            urlPDF = res.publicUrl;
          }
        } catch (stErr) {
          console.warn("Erreur upload facture Supabase Storage:", stErr);
        }
      }

      // 5. PDF téléversé dans Supabase Storage
      return urlPDF || URL.createObjectURL(pdfBlob);
    } catch (error) {
      console.error("Erreur lors de la génération de la facture:", error);
      throw new Error("Impossible de générer la facture.");
    }
  }
};
