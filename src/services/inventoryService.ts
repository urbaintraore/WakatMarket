import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, deleteDoc } from "firebase/firestore";
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

