import { supabase } from "../supabase";

export interface LigneVenteDirecte {
  produitId: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

export interface VenteDirecteData {
  venteId?: string;
  vendeurId: string;
  vendeurNom?: string;
  vendeurRole?: string;
  acheteurId?: string;
  acheteurNom?: string;
  typeVente?: "GROS" | "DETAIL";
  lignes: LigneVenteDirecte[];
  total: number;
  paymentMethod?: string;
  amountPaid?: number;
}

export const venteService = {
  /**
   * Enregistre une vente directe dans PostgreSQL (table ventes / orders)
   */
  async enregistrerVenteHorsLigneDirecte(data: VenteDirecteData): Promise<string> {
    const venteId = data.venteId || `vnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    if (supabase) {
      try {
        await supabase.from("ventes").upsert({
          id: venteId,
          vendeur_id: data.vendeurId,
          vendeur_nom: data.vendeurNom || "Commerçant",
          acheteur_id: data.acheteurId || "CLIENT_ANONYME",
          acheteur_nom: data.acheteurNom || "Client",
          type_vente: data.typeVente || "DETAIL",
          lignes: data.lignes || [],
          total: data.total,
          amount_paid: data.amountPaid !== undefined ? data.amountPaid : data.total,
          payment_method: data.paymentMethod || "CASH",
          created_at: nowIso
        });
      } catch (err) {
        console.warn("Notice vente direct Supabase:", err);
      }
    }

    return venteId;
  }
};
