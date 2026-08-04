import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, deleteDoc, onSnapshot } from "firebase/firestore";
import { InventoryItem, Product } from "../types";
import { filterMockData } from "../data";

const COLLECTION_NAME = "inventory";

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

export const inventoryService = {
  async getAllInventory(): Promise<InventoryItem[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTION_NAME));
      const list: InventoryItem[] = [];
      snap.forEach((docSnap) => {
        if (docSnap.exists()) {
          list.push(docSnap.data() as InventoryItem);
        }
      });
      return filterMockData(list);
    } catch (error: any) {
      console.warn("Firestore error during getAllInventory:", error);
      return [];
    }
  },

  subscribeToInventory(callback: (items: InventoryItem[]) => void) {
    const q = query(collection(db, COLLECTION_NAME));
    let unsub = () => {};
    try {
      unsub = onSnapshot(q, (snapshot) => {
        const list: InventoryItem[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            list.push(docSnap.data() as InventoryItem);
          }
        });
        callback(filterMockData(list));
      }, (error) => {
        console.warn("Firestore error during subscribeToInventory:", error);
      });
    } catch (e) {
      console.warn("Failed to set up real-time listener for inventory:", e);
    }
    return () => {
      try {
        unsub();
      } catch (e) {
        console.warn("Error unsubscribing from inventory:", e);
      }
    };
  },

  async updateInventoryItem(item: InventoryItem): Promise<void> {
    try {
      await setDoc(doc(db, COLLECTION_NAME, item.id), item);
    } catch (error: any) {
      console.warn("Firestore error during updateInventoryItem:", error);
    }
  },

  async deleteInventoryItem(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.warn("Firestore error during deleteInventoryItem:", error);
    }
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
          ? `Produit Périmé : "${prod?.name || 'Produit'}" a expiré depuis ${Math.abs(daysRemaining)} jour(s) (${expDateStr}).`
          : `Alerte Expiration (15j) : "${prod?.name || 'Produit'}" expire dans ${daysRemaining} jour(s) (${expDateStr}).`;

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

