import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, deleteDoc, onSnapshot } from "firebase/firestore";
import { InventoryItem, Product } from "../types";
import { filterMockData } from "../data";
import { supabase } from "../supabase";

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
      return list;
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
        callback(list);
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

  subscribeToUserStock(uid: string, callback: (items: InventoryItem[]) => void) {
    const startTime = Date.now();
    const logPrefix = `[DIAGNOSTIC - subscribeToUserStock] [User: ${uid}]`;
    const connectionStatus = navigator.onLine ? "ONLINE" : "OFFLINE";
    
    const logMsg = (msg: string, isError = false) => {
      const timestamp = new Date().toISOString();
      const formatted = `${timestamp} - ${logPrefix} - ${msg} (Network: ${connectionStatus})`;
      if (isError) {
        console.error(formatted);
      } else {
        console.log(formatted);
      }
      if (typeof window !== "undefined") {
        (window as any).__WAKAT_DIAGNOSTICS = (window as any).__WAKAT_DIAGNOSTICS || [];
        (window as any).__WAKAT_DIAGNOSTICS.push({
          timestamp,
          userId: uid,
          event: "subscribeToUserStock",
          message: msg,
          status: isError ? "ERROR" : "SUCCESS",
          network: connectionStatus,
          latencyMs: Date.now() - startTime
        });
      }
    };

    logMsg(`Initiating Firestore subcollection subscription...`);

    if (!uid) {
      logMsg(`Subscription aborted: No valid user UID provided.`, true);
      return () => {};
    }

    const q = query(collection(db, "stocks", uid, "items"));
    let unsub = () => {};
    try {
      unsub = onSnapshot(q, (snapshot) => {
        const latency = Date.now() - startTime;
        logMsg(`Snapshot successfully received! Count: ${snapshot.size} items. Sync duration: ${latency}ms.`);
        const list: InventoryItem[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            list.push({
              id: data.id || `inv-${uid}-${data.produitId || docSnap.id}`,
              productId: data.produitId || docSnap.id,
              ownerId: uid,
              stock: Number(data.quantite || 0),
              threshold: Number(data.seuilAlerte || 10),
              price: Number(data.prixUnitaire || 0),
              prixGros: Number(data.prixGros ?? data.prixUnitaire ?? 0),
              prixDetail: Number(data.prixDetail ?? data.prixUnitaire ?? 0),
              quantiteMinimum: Number(data.quantiteMinimum ?? 1),
              expirationDate: data.expirationDate || undefined
            });
          }
        });
        callback(list);
      }, (error) => {
        const latency = Date.now() - startTime;
        logMsg(`Firestore subscription error after ${latency}ms: ${error.message} (Code: ${error.code})`, true);
      });
    } catch (e: any) {
      logMsg(`Exception setting up onSnapshot for subcollection: ${e?.message || e}`, true);
    }
    return () => {
      logMsg(`Unsubscribing from user stock subscription.`);
      try {
        unsub();
      } catch (e) {}
    };
  },

  async updateInventoryItem(item: InventoryItem): Promise<void> {
    try {
      // 1. Écriture principale dans la collection racine /inventory/{id}
      await setDoc(doc(db, COLLECTION_NAME, item.id), item);
      
      // 2. Écriture synchronisée dans la sous-collection du propriétaire /stocks/{ownerId}/items/{productId}
      if (item.ownerId && item.productId) {
        try {
          await setDoc(doc(db, "stocks", item.ownerId, "items", item.productId), {
            id: item.id,
            produitId: item.productId,
            quantite: item.stock,
            seuilAlerte: item.threshold || 10,
            prixUnitaire: item.price || 1000,
            prixGros: item.prixGros || item.price || 1000,
            prixDetail: item.prixDetail || item.price || 1000,
            quantiteMinimum: item.quantiteMinimum || 1,
            expirationDate: item.expirationDate || null,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (subErr) {
          console.warn("Notice: Could not sync to /stocks/{uid}/items:", subErr);
        }
      }

      // 3. Synchronisation secondaire Supabase si configuré
      if (supabase) {
        try {
          await supabase
            .from("inventory")
            .upsert({
              id: item.id,
              product_id: item.productId,
              owner_id: item.ownerId,
              stock: item.stock,
              threshold: item.threshold || 10,
              price: item.price || 0,
              expiration_date: item.expirationDate || null,
              prix_gros: item.prixGros || null,
              prix_detail: item.prixDetail || null,
              quantite_minimum: item.quantiteMinimum || null,
              updated_at: new Date().toISOString()
            });
        } catch (supErr) {
          console.warn("Supabase background sync notice:", supErr);
        }
      }
    } catch (error: any) {
      console.error("Erreur critique Firestore lors de la mise à jour du stock:", error);
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${item.id}`);
      throw error;
    }
  },

  async deleteInventoryItem(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));

      if (supabase) {
        try {
          await supabase.from("inventory").delete().eq("id", id);
        } catch (supErr) {
          console.warn("Supabase delete notice:", supErr);
        }
      }
    } catch (error: any) {
      console.error("Erreur critique Firestore lors de la suppression du stock:", error);
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
      throw error;
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

