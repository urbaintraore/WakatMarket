import { Product } from "../types";
import {
  isFirebaseConfigured,
  firebaseConfigError,
  isNetworkError,
  firestoreUpsert,
  firestoreUpdate,
  firestoreDelete,
  firestoreGetLimitOrdered,
  firestoreSubscribe
} from "../firebase";
import { uploadToCloudflare } from "../cloudflare";
import { productToDb, productFromDb } from "./dbMappers";

export interface ProductUploadResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
}

function mapRowToProduct(row: any): Product {
  return productFromDb(row);
}

async function base64ToFile(base64: string, filename: string): Promise<File> {
  const res = await fetch(base64);
  const buf = await res.arrayBuffer();
  const mimeType = base64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || "image/jpeg";
  return new File([buf], filename, { type: mimeType });
}

export const productService = {
  /**
   * Récupérer tous les produits depuis Firestore (collection 'products')
   */
  async getAllProducts(): Promise<Product[]> {
    if (!isFirebaseConfigured()) return [];
    try {
      const rows = await firestoreGetLimitOrdered("products", "created_at", 500);
      return rows.map(mapRowToProduct);
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("[productService] Réseau Firestore indisponible pour getAllProducts (mode hors-ligne).");
      } else {
        console.error("Exception dans getAllProducts:", err);
      }
      return [];
    }
  },

  /**
   * S'abonner aux mises à jour en temps réel de la collection 'products'
   */
  subscribeToProducts(callback: (products: Product[]) => void): () => void {
    if (!isFirebaseConfigured()) return () => {};

    this.getAllProducts().then(callback);

    const unsubscribe = firestoreSubscribe("products", (rows) => {
      callback(rows.map(mapRowToProduct));
    });

    return unsubscribe;
  },

  /**
   * Téléversement d'image produit vers Cloudflare R2 (dossier MonBucket)
   */
  async uploadProductImage(file: File, creatorId?: string, productId?: string): Promise<ProductUploadResult> {
    if (!isFirebaseConfigured()) {
      throw new Error(`Firebase n'est pas configuré : ${firebaseConfigError || "Veuillez renseigner VITE_FIREBASE_*."}`);
    }

    const ext = file.name ? file.name.split(".").pop()?.toLowerCase() || "jpg" : "jpg";
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const userFolder = creatorId || "common";
    const prodFolder = productId || "new";
    const filePath = `products/${userFolder}/${prodFolder}_${timestamp}_${randomSuffix}.${ext}`;
    const folder = "MonBucket";

    const publicUrl = await uploadToCloudflare(folder, filePath, file, file.type || "image/jpeg");
    if (!publicUrl) {
      throw new Error("Échec du téléversement de l'image sur Cloudflare R2 (MonBucket).");
    }

    return {
      publicUrl,
      storagePath: `${folder}/${filePath}`,
      bucket: folder
    };
  },

  /**
   * Créer ou mettre à jour un produit dans Firestore
   */
  async createProduct(product: Product): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error(`Firebase n'est pas initialisé. ${firebaseConfigError || ""}`);
    }

    let finalImageUrl = product.imageUrl || product.image || "";

    // 1. Si l'image est en base64, l'uploader sur Cloudflare R2 (MonBucket)
    if (finalImageUrl.startsWith("data:image")) {
      try {
        const file = await base64ToFile(finalImageUrl, `prod_${product.id}.jpg`);
        const uploadRes = await this.uploadProductImage(file, product.creatorId, product.id);
        finalImageUrl = uploadRes.publicUrl;
      } catch (uploadError) {
        console.warn("Échec de l'upload de l'image sur Cloudflare R2, utilisation du Base64 en fallback:", uploadError);
      }
    }

    // 2. Persister directement dans Firestore via mapper centralisé
    const record = productToDb({
      ...product,
      image: finalImageUrl,
      imageUrl: finalImageUrl,
    });

    if (!record.created_at) record.created_at = new Date().toISOString();

    try {
      await firestoreUpsert("products", record);
    } catch (error: any) {
      console.error("[SYNC PRODUCT] FAILED", {
        productId: product.id,
        error: error.message,
        code: error.code,
        payload: record
      });
      throw error;
    }

    console.log("[SYNC PRODUCT] SUCCESS", {
      productId: product.id,
      name: product.name,
      creatorId: product.creatorId
    });
  },

  /**
   * Mettre à jour un produit
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    if (!isFirebaseConfigured()) return;
    const dbUpdates = productToDb(updates);
    delete dbUpdates.id;

    if (Object.keys(dbUpdates).length === 0) return;

    try {
      await firestoreUpdate("products", id, dbUpdates);
    } catch (error: any) {
      console.error("Erreur update produit Firestore:", error);
      throw error;
    }
  },

  /**
   * Supprimer un produit
   */
  async deleteProduct(id: string): Promise<void> {
    if (!isFirebaseConfigured()) return;
    await firestoreDelete("products", id);
  },

  /**
   * Créer ou mettre à jour un produit
   */
  async createOrUpdateProduct(product: Product): Promise<void> {
    return this.createProduct(product);
  }
};