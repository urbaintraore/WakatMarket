import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
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
      return filterMockData(list);
    } catch (error: any) {
      console.warn("Firestore error during getAllProducts:", error);
      return [];
    }
  },

  async uploadProductImage(file: File): Promise<string | null> {
    if (supabase) {
      const ext = file.name.split('.').pop() || 'jpg';
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
            
          return data.publicUrl;
        }
      } catch (err) {
        console.warn("Notice: Uploading product image to Supabase storage failed, using inline Data URL fallback:", err);
      }
    } else {
      console.info("Supabase storage not configured, using inline Data URL for product image.");
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

  async deleteProduct(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.warn("Firestore error during deleteProduct:", error);
    }
  }
};

