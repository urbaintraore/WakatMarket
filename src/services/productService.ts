import { db, storage, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, query, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Product } from "../types";
import { filterMockData } from "../data";
import { supabase } from "../supabase";

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
    if (supabase) {
      const ext = file.name ? file.name.split('.').pop() : 'jpg';
      const filePath = `products/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      
      try {
        const { error } = await supabase.storage
          .from('chat')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (!error) {
          const { data } = supabase.storage
            .from('chat')
            .getPublicUrl(filePath);
            
          if (data?.publicUrl) return data.publicUrl;
        }
      } catch (err) {
        console.warn("Notice: Uploading product image to Supabase storage failed, trying Firebase Storage:", err);
      }
    }

    // Fallback to Firebase Storage
    try {
      if (storage) {
        const ext = file.name ? file.name.split('.').pop() : 'jpg';
        const storageRef = ref(storage, `products/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`);
        await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
      }
    } catch (fbErr) {
      console.warn("Firebase Storage upload error for product image:", fbErr);
    }

    // Fallback to Data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  },

  async createProduct(product: Product): Promise<void> {
    try {
      // Intercept Base64 images and upload them to Supabase to keep Firestore fast and documents small
      if (product.image && product.image.startsWith("data:image")) {
        try {
          const file = await base64ToFile(product.image, `product_${product.id}.jpg`);
          const url = await this.uploadProductImage(file);
          if (url) {
            product.image = url;
          }
        } catch (e) {
          console.error("Failed to convert/upload base64 product image", e);
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
          console.error("Failed to convert/upload base64 product imageUrl", e);
        }
      }

      await setDoc(doc(db, COLLECTION_NAME, product.id), product);
    } catch (error: any) {
      console.warn("Firestore error during createProduct:", error);
    }
  },

  async createOrUpdateProduct(product: Product): Promise<void> {
    return this.createProduct(product);
  },

  async deleteProduct(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.warn("Firestore error during deleteProduct:", error);
    }
  }
};

