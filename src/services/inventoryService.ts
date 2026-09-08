import { InventoryItem, Product } from "../types";
import {
  isFirebaseConfigured,
  isNetworkError,
  firestoreUpsert,
  firestoreDelete,
  firestoreGetLimitOrdered,
  firestoreGetWhere,
  firestoreSubscribe,
  firestoreSubscribeWhere
} from "../firebase";
import { inventoryToDb, inventoryFromDb } from "./dbMappers";

export interface ExpirationAlert {
  id: string;
  inventoryItemId?: string;
  productId: string;
  productName: string;
  ownerId: string;
  expirationDate: string;
  daysRemaining: number;
  isExpired: boolean;
  message: string;
}

function mapRowToInventoryItem(row: any): InventoryItem {
  return inventoryFromDb(row);
}

export const inventoryService = {
  /**
   * Récupérer tout l'inventaire depuis Firestore (collection 'inventory')
   */
  async getAllInventory(): Promise<InventoryItem[]> {
    if (!isFirebaseConfigured()) return [];
    try {
      const rows = await firestoreGetLimitOrdered("inventory", "updated_at", 500);
      return rows.map(mapRowToInventoryItem);
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("[inventoryService] Réseau Firestore indisponible pour getAllInventory (mode hors-ligne).");
      } else {
        console.error("Erreur getAllInventory Firestore:", err);
      }
      return [];
    }
  },

  /**
   * Récupérer le stock d'un acteur spécifique
   */
  async getUserStock(uid: string): Promise<InventoryItem[]> {
    if (!isFirebaseConfigured() || !uid) return [];
    try {
      const rows = await firestoreGetWhere("inventory", "owner_id", "==", uid);
      return rows.map(mapRowToInventoryItem);
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("[inventoryService] Réseau Firestore indisponible pour getUserStock (mode hors-ligne).");
      } else {
        console.error("Erreur getUserStock Firestore:", err);
      }
      return [];
    }
  },

  /**
   * S'abonner aux changements de tout l'inventaire en temps réel
   */
  subscribeToInventory(callback: (items: InventoryItem[]) => void): () => void {
    if (!isFirebaseConfigured()) return () => {};

    this.getAllInventory().then(callback);

    const unsubscribe = firestoreSubscribe("inventory", (rows) => {
      callback(rows.map(mapRowToInventoryItem));
    });

    return unsubscribe;
  },

  /**
   * S'abonner aux changements de stock d'un utilisateur en temps réel
   */
  subscribeToUserStock(uid: string, callback: (items: InventoryItem[]) => void): () => void {
    if (!isFirebaseConfigured() || !uid) return () => {};

    this.getUserStock(uid).then(callback);

    const unsubscribe = firestoreSubscribeWhere("inventory", "owner_id", "==", uid, (rows) => {
      callback(rows.map(mapRowToInventoryItem));
    });

    return unsubscribe;
  },

  /**
   * Enregistrer ou mettre à jour un article en stock dans Firestore
   */
  async updateInventoryItem(item: InventoryItem): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error("Firebase n'est pas initialisé.");
    }

    const record = inventoryToDb(item);
    if (!record.updated_at) record.updated_at = item.updatedAt || new Date().toISOString();

    try {
      await firestoreUpsert("inventory", record);
    } catch (error: any) {
      console.error("[SYNC INVENTORY] FAILED", {
        productId: item.productId,
        inventoryId: item.id,
        ownerId: item.ownerId,
        stock: item.stock,
        error: error.message,
        code: error.code,
        payloadSent: record
      });
      throw error;
    }

    console.log("[SYNC INVENTORY] SUCCESS", {
      productId: item.productId,
      inventoryId: item.id,
      ownerId: item.ownerId,
      stock: item.stock
    });
  },

  /**
   * Supprimer un article de l'inventaire
   */
  async deleteInventoryItem(id: string): Promise<void> {
    if (!isFirebaseConfigured()) return;
    await firestoreDelete("inventory", id);
  },

  /**
   * Mécanisme de détection des produits expirant sous 15 jours ou déjà périmés.
   */
  checkExpirationAlerts(
    inventory: InventoryItem[],
    products: Product[],
    daysThreshold: number = 15
  ): ExpirationAlert[] {
    const alerts: ExpirationAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    inventory.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const expDateStr = item.expirationDate || prod?.expirationDate;
      if (!expDateStr) return;

      const expDate = new Date(expDateStr);
      if (isNaN(expDate.getTime())) return;
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining <= daysThreshold) {
        const isExpired = daysRemaining < 0;
        const message = isExpired
          ? `Produit Périmé : "${prod?.name || "Produit"}" a expiré depuis ${Math.abs(daysRemaining)} jour(s) (${expDateStr}).`
          : `Alerte Expiration (15j) : "${prod?.name || "Produit"}" expire dans ${daysRemaining} jour(s) (${expDateStr}).`;

        alerts.push({
          id: `exp-${item.id}-${expDateStr}`,
          inventoryItemId: item.id,
          productId: item.productId,
          productName: prod?.name || "Produit",
          ownerId: item.ownerId,
          expirationDate: expDateStr,
          daysRemaining,
          isExpired,
          message,
        });
      }
    });

    return alerts;
  }
};