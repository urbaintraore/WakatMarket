import { InventoryItem, Product } from "../types";
import { supabase } from "../supabase";

export interface ExpirationAlert {
  id: string;
  inventoryItemId?: string;
  productId: string;
  productName: string;
  ownerId: string;
  expirationDate: string;
  daysRemaining: number;
  isExpired: boolean;
  message: string;
}

function mapRowToInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    productId: row.product_id || row.productId,
    ownerId: row.owner_id || row.ownerId,
    stock: Number(row.quantity ?? row.stock ?? 0),
    threshold: Number(row.low_stock_threshold ?? row.threshold ?? 5),
    price: Number(row.price ?? 0),
    prixGros: row.prix_gros ? Number(row.prix_gros) : undefined,
    prixDetail: row.prix_detail ? Number(row.prix_detail) : undefined,
    quantiteMinimum: row.quantite_minimum ? Number(row.quantite_minimum) : 1,
    expirationDate: row.expiration_date || undefined,
    updatedAt: row.updated_at || undefined
  };
}

export const inventoryService = {
  /**
   * Récupérer tout l'inventaire depuis la table PostgreSQL 'inventory'
   */
  async getAllInventory(): Promise<InventoryItem[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Erreur getAllInventory Supabase:", error);
        return [];
      }

      return (data || []).map(mapRowToInventoryItem);
    } catch (err) {
      console.error("Exception dans getAllInventory:", err);
      return [];
    }
  },

  /**
   * Récupérer le stock d'un acteur spécifique
   */
  async getUserStock(uid: string): Promise<InventoryItem[]> {
    if (!supabase || !uid) return [];
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("owner_id", uid);

      if (error) {
        console.error("Erreur getUserStock Supabase:", error);
        return [];
      }

      return (data || []).map(mapRowToInventoryItem);
    } catch (err) {
      console.error("Exception dans getUserStock:", err);
      return [];
    }
  },

  /**
   * S'abonner aux changements de tout l'inventaire en temps réel
   */
  subscribeToInventory(callback: (items: InventoryItem[]) => void): () => void {
    if (!supabase) return () => {};

    this.getAllInventory().then(callback);

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:inventory:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => {
          this.getAllInventory().then(callback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * S'abonner aux changements de stock d'un utilisateur en temps réel
   */
  subscribeToUserStock(uid: string, callback: (items: InventoryItem[]) => void): () => void {
    if (!supabase || !uid) return () => {};

    this.getUserStock(uid).then(callback);

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:inventory:user:${uid}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory", filter: `owner_id=eq.${uid}` },
        () => {
          this.getUserStock(uid).then(callback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Enregistrer ou mettre à jour un article en stock dans PostgreSQL
   */
  async updateInventoryItem(item: InventoryItem): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    const record = {
      id: item.id,
      product_id: item.productId,
      owner_id: item.ownerId,
      stock: Number(item.stock || 0),
      threshold: Number(item.threshold || 5),
      price: Number(item.price || 0),
      prix_gros: item.prixGros !== undefined ? Number(item.prixGros) : null,
      prix_detail: item.prixDetail !== undefined ? Number(item.prixDetail) : null,
      quantite_minimum: item.quantiteMinimum !== undefined ? Number(item.quantiteMinimum) : 1,
      expiration_date: item.expirationDate || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("inventory")
      .upsert(record)
      .select()
      .single();

    if (error) {
      console.error("[SYNC INVENTORY] FAILED", {
        productId: item.productId,
        inventoryId: item.id,
        ownerId: item.ownerId,
        stock: item.stock,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        payloadSent: record
      });
      throw error;
    }

    console.log("[SYNC INVENTORY] SUCCESS", {
      productId: item.productId,
      inventoryId: item.id,
      ownerId: item.ownerId,
      stock: item.stock,
      data
    });
  },

  /**
   * Supprimer un article de l'inventaire
   */
  async deleteInventoryItem(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) {
      console.error("Erreur suppression inventory Supabase:", error);
      throw error;
    }
  },

  /**
   * Mécanisme de détection des produits expirant sous 15 jours ou déjà périmés.
   */
  checkExpirationAlerts(
    inventory: InventoryItem[],
    products: Product[],
    daysThreshold: number = 15
  ): ExpirationAlert[] {
    const alerts: ExpirationAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    inventory.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const expDateStr = item.expirationDate || prod?.expirationDate;
      if (!expDateStr) return;

      const expDate = new Date(expDateStr);
      if (isNaN(expDate.getTime())) return;
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining <= daysThreshold) {
        const isExpired = daysRemaining < 0;
        const message = isExpired
          ? `Produit Périmé : "${prod?.name || "Produit"}" a expiré depuis ${Math.abs(daysRemaining)} jour(s) (${expDateStr}).`
          : `Alerte Expiration (15j) : "${prod?.name || "Produit"}" expire dans ${daysRemaining} jour(s) (${expDateStr}).`;

        alerts.push({
          id: `exp-${item.id}-${expDateStr}`,
          inventoryItemId: item.id,
          productId: item.productId,
          productName: prod?.name || "Produit",
          ownerId: item.ownerId,
          expirationDate: expDateStr,
          daysRemaining,
          isExpired,
          message,
        });
      }
    });

    return alerts;
  }
};
