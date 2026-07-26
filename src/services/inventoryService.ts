import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, deleteDoc, onSnapshot } from "firebase/firestore";
import { InventoryItem } from "../types";
import { filterMockData } from "../data";

const COLLECTION_NAME = "inventory";

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
  }
};

