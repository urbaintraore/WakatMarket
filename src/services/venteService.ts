import { db } from "../firebase/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Order } from "../types";

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
   * avec le statut "en_attente_synchronisation".
   * Firestore (avec la persistance IndexedDB activée) met ce document en file d'attente
   * locale si l'appareil est hors-ligne. Dès que le réseau est rétabli, la Cloud Function
   * `onVenteCreated` valide la transaction et décrémente définitivement le stock sur le serveur.
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
    await setDoc(venteRef, documentVente);

    return venteId;
  }
};
