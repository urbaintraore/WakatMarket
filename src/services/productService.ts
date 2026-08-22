import { Product } from "../types";
import { supabase, uploadToSupabaseStorage, formatStorageUrl, supabaseConfigError } from "../supabase";
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
   * Récupérer tous les produits depuis la table PostgreSQL 'products'
   */
  async getAllProducts(): Promise<Product[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur getAllProducts Supabase:", error);
        return [];
      }

      return (data || []).map(mapRowToProduct);
    } catch (err) {
      console.error("Exception dans getAllProducts:", err);
      return [];
    }
  },

  /**
   * S'abonner aux mises à jour en temps réel de la table 'products'
   */
  subscribeToProducts(callback: (products: Product[]) => void): () => void {
    if (!supabase) return () => {};

    // Chargement initial
    this.getAllProducts().then(callback);

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:products:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          this.getAllProducts().then(callback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Téléversement d'image produit vers Supabase Storage (MonBucket)
   */
  async uploadProductImage(file: File, creatorId?: string, productId?: string): Promise<ProductUploadResult> {
    if (!supabase) {
      throw new Error(`Supabase n'est pas configuré : ${supabaseConfigError || "Veuillez renseigner VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY."}`);
    }

    const ext = file.name ? file.name.split(".").pop()?.toLowerCase() || "jpg" : "jpg";
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const userFolder = creatorId || "common";
    const prodFolder = productId || "new";
    const filePath = `products/${userFolder}/${prodFolder}_${timestamp}_${randomSuffix}.${ext}`;
    const targetBucket = "MonBucket";

    const res = await uploadToSupabaseStorage(targetBucket, filePath, file, file.type || "image/jpeg");
    if (!res || !res.publicUrl) {
      throw new Error("Échec du téléversement de l'image sur Supabase Storage (MonBucket).");
    }

    return {
      publicUrl: res.publicUrl,
      storagePath: filePath,
      bucket: res.bucket
    };
  },

  /**
   * Créer ou mettre à jour un produit dans PostgreSQL
   */
  async createProduct(product: Product): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    let finalImageUrl = product.imageUrl || product.image || "";

    // 1. Si l'image est en base64, l'uploader sur Supabase Storage (MonBucket)
    if (finalImageUrl.startsWith("data:image")) {
      try {
        const file = await base64ToFile(finalImageUrl, `prod_${product.id}.jpg`);
        const uploadRes = await this.uploadProductImage(file, product.creatorId, product.id);
        finalImageUrl = uploadRes.publicUrl;
      } catch (uploadError) {
        console.warn("Échec de l'upload de l'image sur Supabase Storage, utilisation du Base64 en fallback:", uploadError);
      }
    }

    // 2. Persister directement dans la table PostgreSQL 'products' via mapper centralisé
    const record = productToDb({
      ...product,
      image: finalImageUrl,
      imageUrl: finalImageUrl,
    });

    const { data, error } = await supabase
      .from("products")
      .upsert(record)
      .select()
      .single();

    if (error) {
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
      creatorId: product.creatorId,
      data
    });
  },

  /**
   * Mettre à jour un produit
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    if (!supabase) return;
    const dbUpdates = productToDb(updates);
    delete dbUpdates.id;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from("products").update(dbUpdates).eq("id", id);
    if (error) {
      console.error("Erreur update produit Supabase:", error);
      throw error;
    }
  },

  /**
   * Supprimer un produit
   */
  async deleteProduct(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error("Erreur suppression produit Supabase:", error);
      throw error;
    }
  },

  /**
   * Créer ou mettre à jour un produit
   */
  async createOrUpdateProduct(product: Product): Promise<void> {
    return this.createProduct(product);
  }
};

