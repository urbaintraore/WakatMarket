import { Product } from "../types";
import { supabase, uploadToSupabaseStorage, formatStorageUrl, supabaseConfigError } from "../supabase";

export interface ProductUploadResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
}

function mapRowToProduct(row: any): Product {
  const imageUrl = formatStorageUrl(row.image_url || row.image);
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    category: row.category || "",
    subCategory: row.sub_category || "",
    brand: row.brand || "",
    unit: row.unit || "Pièce",
    weight: row.weight ? Number(row.weight) : 0,
    volume: row.volume ? Number(row.volume) : 0,
    image: imageUrl,
    imageUrl: imageUrl,
    barcode: row.barcode || "",
    qrCode: row.qr_code || "",
    expirationDate: row.expiration_date || undefined,
    creatorId: row.creator_id || "",
    prixGros: row.prix_gros ? Number(row.prix_gros) : (row.base_price ? Number(row.base_price) : undefined),
    prixDetail: row.prix_detail ? Number(row.prix_detail) : undefined,
    quantiteMinimum: row.quantite_minimum ? Number(row.quantite_minimum) : 1,
    typeVente: row.type_vente || "BOTH"
  };
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
    let storagePath: string | null = (product as any).imagePath || null;

    // 1. Si l'image est en base64, l'uploader sur Supabase Storage (MonBucket)
    if (finalImageUrl.startsWith("data:image")) {
      try {
        const file = await base64ToFile(finalImageUrl, `prod_${product.id}.jpg`);
        const uploadRes = await this.uploadProductImage(file, product.creatorId, product.id);
        finalImageUrl = uploadRes.publicUrl;
        storagePath = uploadRes.storagePath;
      } catch (uploadError) {
        console.warn("Échec de l'upload de l'image sur Supabase Storage, utilisation du Base64 en fallback:", uploadError);
        // On conserve finalImageUrl comme base64
      }
    }

    // 2. Persister directement dans la table PostgreSQL 'products'
    const record = {
      id: product.id,
      creator_id: product.creatorId || null,
      name: product.name,
      category: product.category || "Alimentation",
      sub_category: product.subCategory || null,
      brand: product.brand || null,
      description: product.description || "",
      unit: product.unit || "Pièce",
      weight: product.weight || 0,
      volume: product.volume || 0,
      image_url: finalImageUrl,
      image_storage_path: storagePath,
      base_price: product.prixGros || product.prixDetail || 0,
      prix_gros: product.prixGros || null,
      prix_detail: product.prixDetail || null,
      quantite_minimum: product.quantiteMinimum || 1,
      barcode: product.barcode || null,
      qr_code: product.qrCode || null,
      expiration_date: product.expirationDate || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("products").upsert(record);
    if (error) {
      console.error("Erreur enregistrement produit dans Supabase (products):", error);
      throw error;
    }
  },

  /**
   * Mettre à jour un produit
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    if (!supabase) return;
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.prixGros !== undefined) dbUpdates.prix_gros = updates.prixGros;
    if (updates.prixDetail !== undefined) dbUpdates.prix_detail = updates.prixDetail;
    if (updates.quantiteMinimum !== undefined) dbUpdates.quantite_minimum = updates.quantiteMinimum;
    if (updates.image || updates.imageUrl) {
      dbUpdates.image_url = formatStorageUrl(updates.imageUrl || updates.image);
    }

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
