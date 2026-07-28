import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { Order } from "../types";
import { filterMockData } from "../data";

const COLLECTION_NAME = "orders";

export const orderService = {
  async getAllOrders(): Promise<Order[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTION_NAME));
      const list: Order[] = [];
      snap.forEach((docSnap) => {
        if (docSnap.exists()) {
          list.push(docSnap.data() as Order);
        }
      });
      return filterMockData(list);
    } catch (error: any) {
      console.warn("Firestore error during getAllOrders:", error);
      return [];
    }
  },

  async createOrder(order: Order): Promise<void> {
    try {
      await setDoc(doc(db, COLLECTION_NAME, order.id), order);
    } catch (error: any) {
      console.warn("Firestore error during createOrder:", error);
    }
  },

  async updateOrder(orderId: string, fields: Partial<Order>): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, orderId), fields as any);
    } catch (error: any) {
      console.warn("Firestore error during updateOrder:", error);
    }
  },

  async updateOrder(orderId: string, fields: Partial<Order>): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, orderId), fields as any);
    } catch (error: any) {
      console.warn("Firestore error during updateOrder:", error);
    }
  },

  subscribeToOrders(callback: (orders: Order[]) => void) {
    const unsub = import("firebase/firestore").then(({ onSnapshot, collection }) => {
      return onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            list.push(docSnap.data() as Order);
          }
        });
        callback(filterMockData(list));
      }, (error) => {
        console.warn("Firestore error during subscribeToOrders:", error);
      });
    });
    
    return () => {
      unsub.then(u => u && u());
    };
  }
};
