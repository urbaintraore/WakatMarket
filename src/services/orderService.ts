import { Order, OrderStatus } from "../types";
import { supabase } from "../supabase";
import { orderToDb, orderFromDb } from "./dbMappers";

function mapRowToOrder(row: any): Order {
  return orderFromDb(row);
}

export const orderService = {
  /**
   * Récupérer toutes les commandes depuis PostgreSQL
   */
  async getAllOrders(): Promise<Order[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur getAllOrders Supabase:", error);
        return [];
      }

      return (data || []).map(mapRowToOrder);
    } catch (err) {
      console.error("Exception dans getAllOrders:", err);
      return [];
    }
  },

  /**
   * Créer une commande dans PostgreSQL
   */
  async createOrder(order: Order): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    const orderRecord = orderToDb(order);

    const { error } = await supabase.from("orders").upsert(orderRecord);
    if (error) {
      console.error("Erreur createOrder Supabase:", error);
      throw error;
    }
  },

  /**
   * Mettre à jour une commande (seul status ou total/items existent en DB)
   */
  async updateOrder(orderId: string, fields: Partial<Order> & { total?: number }): Promise<void> {
    if (!supabase || !orderId) return;

    const updates: Record<string, any> = {};

    if (fields.status) updates.status = fields.status;
    if (fields.totalAmount !== undefined || fields.total !== undefined) {
      updates.total = fields.totalAmount ?? fields.total;
    }
    if (fields.items !== undefined) {
      updates.items = typeof fields.items === "string" ? fields.items : JSON.stringify(fields.items);
    }

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
    if (error) {
      console.error("Erreur updateOrder Supabase:", error);
      throw error;
    }
  },

  /**
   * S'abonner aux commandes en temps réel
   */
  subscribeToOrders(callback: (orders: Order[]) => void): () => void {
    if (!supabase) return () => {};

    this.getAllOrders().then(callback);

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:orders:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          this.getAllOrders().then(callback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};

