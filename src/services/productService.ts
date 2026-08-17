import { db, storage, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, query, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Product } from "../types";
import { filterMockData } from "../data";
import { supabase, uploadToSupabaseStorage, upsertToSupabaseTable, deleteFromSupabaseTable } from "../supabase";

const COLLECTION_NAME = "products";

async function base64ToFile(base64: string, filename: string): Promise<File> {
  const res = await fetch(base64);
  const buf = await res.arrayBuffer();
  const mimeType = base64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg';
  return new File([buf], filename, { type: mimeType });
}

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
      return list;
    } catch (error: any) {
      console.warn("Firestore error during getAllProducts:", error);
      return [];
    }
  },

  subscribeToProducts(callback: (products: Product[]) => void) {
    const q = query(collection(db, COLLECTION_NAME));
    let unsub = () => {};
    try {
      unsub = onSnapshot(q, (snapshot) => {
        const list: Product[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            list.push(docSnap.data() as Product);
          }
        });
        callback(list);
      }, (error) => {
        console.warn("Firestore error during subscribeToProducts:", error);
      });
    } catch (e) {
      console.warn("Failed to set up real-time listener for products:", e);
    }
    return () => {
      try {
        unsub();
      } catch (e) {
        console.warn("Error unsubscribing from products:", e);
      }
    };
  },

  async uploadProductImage(file: File): Promise<string | null> {
    const ext = file.name ? file.name.split('.').pop() : 'jpg';
    const filePath = `products/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    
    // 1. Essai de téléversement prioritaire vers Supabase Storage (Bucket 2)
    if (supabase) {
      try {
        const res = await uploadToSupabaseStorage("Bucket 2", filePath, file);
        if (res?.publicUrl) {
          return res.publicUrl;
        }
      } catch (supErr) {
        console.warn("Supabase Storage upload warning (fallback to Firebase Storage):", supErr);
      }
    }

    // 2. Fallback vers Firebase Storage
    if (storage) {
      try {
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || "image/jpeg"
        });
        return await getDownloadURL(storageRef);
      } catch (fbErr) {
        console.warn("Firebase Storage upload fallback warning:", fbErr);
      }
    }

    return null;
  },

  async createProduct(product: Product): Promise<void> {
    try {
      // Intercept Base64 images and upload them to Cloud Storage if available
      if (product.image && product.image.startsWith("data:image")) {
        try {
          const file = await base64ToFile(product.image, `product_${product.id}.jpg`);
          const url = await this.uploadProductImage(file);
          if (url) {
            product.image = url;
          }
        } catch (e) {
          console.warn("Notice: impossible de convertir l'image base64 principale, conservation de l'originale:", e);
        }
      }
      
      if (product.imageUrl && product.imageUrl.startsWith("data:image")) {
        try {
          const file = await base64ToFile(product.imageUrl, `product_${product.id}_url.jpg`);
          const url = await this.uploadProductImage(file);
          if (url) {
            product.imageUrl = url;
          }
        } catch (e) {
          console.warn("Notice: impossible de convertir l'image base64 secondaire, conservation de l'originale:", e);
        }
      }

      // Save to Firestore (Source de vérité)
      await setDoc(doc(db, COLLECTION_NAME, product.id), product);

      // Sync to Supabase table if configured
      if (supabase) {
        try {
          await upsertToSupabaseTable("products", {
            id: product.id,
            name: product.name,
            description: product.description || "",
            category: product.category || "",
            brand: product.brand || "",
            unit: product.unit || "",
            creator_id: product.creatorId || null,
            prix_gros: product.prixGros || null,
            prix_detail: product.prixDetail || null,
            image: product.image || product.imageUrl || null,
            created_at: new Date().toISOString()
          });
        } catch (supErr) {
          console.warn("Supabase background sync warning on products table:", supErr);
        }
      }
    } catch (error: any) {
      console.error("Erreur critique Firestore lors de la création du produit:", error);
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${product.id}`);
      throw error;
    }
  },

  async createOrUpdateProduct(product: Product): Promise<void> {
    return this.createProduct(product);
  },

  async deleteProduct(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      if (supabase) {
        try {
          await deleteFromSupabaseTable("products", id);
        } catch (supErr) {
          console.warn("Supabase background delete warning on products table:", supErr);
        }
      }
    } catch (error: any) {
      console.error("Erreur critique Firestore lors de la suppression du produit:", error);
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
      throw error;
    }
  }
};

