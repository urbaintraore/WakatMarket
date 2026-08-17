import { db, handleFirestoreError, OperationType, sanitizeFirestoreData } from "../firebase/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, query, onSnapshot } from "firebase/firestore";
import { Product } from "../types";
import { supabase, uploadToSupabaseStorage, upsertToSupabaseTable, deleteFromSupabaseTable, formatStorageUrl } from "../supabase";

const COLLECTION_NAME = "products";

export interface ProductUploadResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
}

function normalizeProduct(prod: Product): Product {
  return {
    ...prod,
    image: prod.image ? formatStorageUrl(prod.image) : prod.image,
    imageUrl: prod.imageUrl ? formatStorageUrl(prod.imageUrl) : (prod.image ? formatStorageUrl(prod.image) : prod.imageUrl)
  };
}

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
          list.push(normalizeProduct(docSnap.data() as Product));
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
            list.push(normalizeProduct(docSnap.data() as Product));
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

  /**
   * Upload product image exclusively to Supabase Storage (Bucket 2)
   */
  async uploadProductImage(file: File, creatorId?: string, productId?: string): Promise<ProductUploadResult> {
    if (!supabase) {
      throw new Error("Supabase n'est pas configuré. Veuillez renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
    }

    const ext = file.name ? file.name.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const userFolder = creatorId || 'common';
    const prodFolder = productId || 'new';
    const filePath = `products/${userFolder}/${prodFolder}_${timestamp}_${randomSuffix}.${ext}`;
    const bucket = "Bucket 2";

    const res = await uploadToSupabaseStorage(bucket, filePath, file, file.type || 'image/jpeg');
    if (!res || !res.publicUrl) {
      throw new Error("Échec du téléversement du fichier sur Supabase Storage (Bucket 2).");
    }

    return {
      publicUrl: res.publicUrl,
      storagePath: filePath,
      bucket: bucket
    };
  },

  async createProduct(product: Product): Promise<void> {
    let uploadedPath: string | null = null;
    const bucket = "Bucket 2";

    try {
      // 1. Intercept base64 images and upload them exclusively to Supabase Storage
      if (product.image && product.image.startsWith("data:image")) {
        try {
          const file = await base64ToFile(product.image, `product_${product.id}.jpg`);
          const uploadRes = await this.uploadProductImage(file, product.creatorId, product.id);
          product.image = uploadRes.publicUrl;
          product.imageUrl = uploadRes.publicUrl;
          (product as any).imagePath = uploadRes.storagePath;
          (product as any).imageBucket = uploadRes.bucket;
          uploadedPath = uploadRes.storagePath;
        } catch (uploadErr: any) {
          console.error("Échec upload Supabase pour image produit:", uploadErr);
          throw new Error(`Le fichier a échoué à l'envoi vers Supabase Storage : ${uploadErr.message || uploadErr}`);
        }
      } else if (product.imageUrl && product.imageUrl.startsWith("data:image")) {
        try {
          const file = await base64ToFile(product.imageUrl, `product_${product.id}_url.jpg`);
          const uploadRes = await this.uploadProductImage(file, product.creatorId, product.id);
          product.imageUrl = uploadRes.publicUrl;
          product.image = uploadRes.publicUrl;
          (product as any).imagePath = uploadRes.storagePath;
          (product as any).imageBucket = uploadRes.bucket;
          uploadedPath = uploadRes.storagePath;
        } catch (uploadErr: any) {
          console.error("Échec upload Supabase pour image secondaire:", uploadErr);
          throw new Error(`Le fichier secondaire a échoué à l'envoi vers Supabase Storage : ${uploadErr.message || uploadErr}`);
        }
      }

      // 2. Persist to Firestore (Source of truth)
      const sanitizedProduct = sanitizeFirestoreData(product);
      await setDoc(doc(db, COLLECTION_NAME, product.id), sanitizedProduct);

      // 3. Mirror metadata to Supabase table if available
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
            image_path: (product as any).imagePath || null,
            image_bucket: (product as any).imageBucket || null,
            created_at: new Date().toISOString()
          });
        } catch (supErr) {
          console.warn("Supabase background sync warning on products table:", supErr);
        }
      }
    } catch (error: any) {
      console.error("Erreur lors de la publication du produit dans Firestore:", error);
      // Clean up orphaned uploaded file if Firestore write failed
      if (uploadedPath && supabase) {
        try {
          await supabase.storage.from(bucket).remove([uploadedPath]);
          console.log(`Cleaned up orphaned file ${uploadedPath} from Supabase Storage.`);
        } catch (cleanErr) {
          console.warn("Could not remove orphaned file from Supabase Storage:", cleanErr);
        }
      }
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

