import { db, sanitizeFirestoreData } from "../firebase/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Order } from "../types";
import { supabase, upsertToSupabaseTable } from "../supabase";

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
   * Enregistre une vente par écriture Firestore directe dans /ventes/{venteId}
   * avec le statut "en_attente_synchronisation" et synchronise vers Supabase.
   */
  async enregistrerVenteHorsLigneDirecte(data: VenteDirecteData): Promise<string> {
    const venteId = data.venteId || `vnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const venteRef = doc(db, "ventes", venteId);

    const nowIso = new Date().toISOString();
    const documentVente = {
      id: venteId,
      venteId,
      vendeurId: data.vendeurId,
      vendeurNom: data.vendeurNom || "Commerçant",
      vendeurRole: data.vendeurRole || "RETAILER",
      acheteurId: data.acheteurId || "CLIENT_ANONYME",
      acheteurNom: data.acheteurNom || "Client",
      typeVente: data.typeVente || "DETAIL",
      lignes: data.lignes,
      total: data.total,
      amountPaid: data.amountPaid !== undefined ? data.amountPaid : data.total,
      paymentMethod: data.paymentMethod || "CASH",
      statut: "en_attente_synchronisation",
      statutPaiement: (data.amountPaid || 0) >= data.total ? "valide" : "attente",
      isProvisional: true, // Marqueur provisoire local
      dateCreation: serverTimestamp(),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Écriture directe dans Firestore (bénéficie d'IndexedDB offline)
    const sanitized = sanitizeFirestoreData(documentVente);
    await setDoc(venteRef, sanitized);

    // Sync to Supabase
    if (supabase) {
      await upsertToSupabaseTable("ventes", {
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
    }

    return venteId;
  }
};

