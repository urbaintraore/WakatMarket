import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { Product } from "../types";
import { filterMockData } from "../data";

const COLLECTION_NAME = "products";

export const productService = {
  async getAllProducts(): Promise<Product[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTION_NAME));
      const list: Product[] = [];
      snap.forEach((docSnap) => {
        if (docSnap.exists()) {
          list.push(docSnap.data() as Product);
        }
      });
      return filterMockData(list);
    } catch (error: any) {
      console.warn("Firestore error during getAllProducts:", error);
      return [];
    }
  },

  async createProduct(product: Product): Promise<void> {
    try {
      await setDoc(doc(db, COLLECTION_NAME, product.id), product);
    } catch (error: any) {
      console.warn("Firestore error during createProduct:", error);
    }
  },

  async deleteProduct(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.warn("Firestore error during deleteProduct:", error);
    }
  }
};
