import { supabase } from "../supabase";
import { syncService } from "./syncService";

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
   * Enregistre une vente directe dans PostgreSQL (table ventes) selon le schéma officiel
   */
  async enregistrerVenteHorsLigneDirecte(data: VenteDirecteData): Promise<string> {
    const venteId = data.venteId || `vnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const ventePayload = {
      id: venteId,
      vendeur_id: data.vendeurId,
      vendeur_nom: data.vendeurNom || "Commerçant",
      acheteur_id: data.acheteurId || "CLIENT_ANONYME",
      acheteur_nom: data.acheteurNom || "Client",
      total: data.total,
      mode_paiement: data.paymentMethod || "CASH",
      statut: "COMPLETE",
      created_at: nowIso
    };

    // 1. Enfiler dans la SyncQueue persistante pour supporter l'Offline-First
    await syncService.enqueue("vente", venteId, "CREATE", ventePayload);

    return venteId;
  }
};
