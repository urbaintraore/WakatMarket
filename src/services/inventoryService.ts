import { InventoryItem, Product } from "../types";
import { supabase, isNetworkError } from "../supabase";
import { inventoryToDb, inventoryFromDb } from "./dbMappers";

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
  return inventoryFromDb(row);
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
        if (isNetworkError(error)) {
          console.warn("[inventoryService] Réseau Supabase indisponible pour getAllInventory (mode hors-ligne).");
        } else {
          console.error("Erreur getAllInventory Supabase:", error);
        }
        return [];
      }

      return (data || []).map(mapRowToInventoryItem);
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("[inventoryService] Exception réseau getAllInventory (mode hors-ligne):", (err as any)?.message || err);
      } else {
        console.error("Exception dans getAllInventory:", err);
      }
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
        if (isNetworkError(error)) {
          console.warn("[inventoryService] Réseau Supabase indisponible pour getUserStock (mode hors-ligne).");
        } else {
          console.error("Erreur getUserStock Supabase:", error);
        }
        return [];
      }

      return (data || []).map(mapRowToInventoryItem);
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("[inventoryService] Exception réseau getUserStock (mode hors-ligne):", (err as any)?.message || err);
      } else {
        console.error("Exception dans getUserStock:", err);
      }
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

    const record = inventoryToDb(item);

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

