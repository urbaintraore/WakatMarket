import { Order, OrderStatus } from "../types";
import { supabase } from "../supabase";

function mapRowToOrder(row: any): Order {
  let parsedItems = [];
  if (Array.isArray(row.items)) {
    parsedItems = row.items;
  } else if (typeof row.items === "string") {
    try {
      parsedItems = JSON.parse(row.items);
    } catch (e) {
      parsedItems = [];
    }
  }

  return {
    id: row.id,
    orderType: row.order_type || "B2B_W2R",
    senderId: row.buyer_id || row.sender_id || row.senderId || "",
    receiverId: row.seller_id || row.receiver_id || row.receiverId || "",
    items: parsedItems,
    totalAmount: Number(row.total_amount || 0),
    amountPaid: Number(row.amount_paid || 0),
    paymentStatus: row.payment_status || "PENDING",
    status: (row.status as OrderStatus) || OrderStatus.PENDING,
    clientId: row.client_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    shippingFee: Number(row.shipping_fee || 0),
    distanceKm: Number(row.distance_km || 0),
    estimatedTimeMins: Number(row.estimated_time_mins || 0),
    paymentMethod: row.payment_method || "CASH",
    deliveryAddress: row.delivery_address || "",
    deliveryNotes: row.delivery_notes || "",
    driverId: row.driver_id || undefined,
    otpCode: row.otp_code || undefined,
    preuvePaiementUrl: row.payment_proof_url || undefined,
    statutPaiement: row.statut_paiement || undefined
  };
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

    const orderRecord = {
      id: order.id,
      buyer_id: order.senderId,
      seller_id: order.receiverId,
      sender_id: order.senderId,
      receiver_id: order.receiverId,
      order_type: order.orderType || "B2B_W2R",
      status: order.status || OrderStatus.PENDING,
      total_amount: order.totalAmount || 0,
      amount_paid: order.amountPaid || 0,
      payment_status: order.paymentStatus || "PENDING",
      payment_method: order.paymentMethod || "CASH",
      delivery_address: order.deliveryAddress || "",
      delivery_notes: order.deliveryNotes || "",
      shipping_fee: order.shippingFee || 0,
      items: order.items || [],
      created_at: order.createdAt || new Date().toISOString(),
      updated_at: order.updatedAt || new Date().toISOString()
    };

    const { error } = await supabase.from("orders").upsert(orderRecord);
    if (error) {
      console.error("Erreur createOrder Supabase:", error);
      throw error;
    }

    // Insérer également les lignes de commandes individuelles si disponibles
    if (order.items && order.items.length > 0) {
      const itemsToInsert = order.items.map((item, idx) => ({
        id: `${order.id}-item-${idx}`,
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.priceAtOrder,
        subtotal: item.quantity * item.priceAtOrder
      }));

      try {
        await supabase.from("order_items").upsert(itemsToInsert);
      } catch (itemErr) {
        console.warn("Notice insertion order_items:", itemErr);
      }
    }
  },

  /**
   * Mettre à jour une commande
   */
  async updateOrder(orderId: string, fields: Partial<Order>): Promise<void> {
    if (!supabase || !orderId) return;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (fields.status) updates.status = fields.status;
    if (fields.paymentStatus) updates.payment_status = fields.paymentStatus;
    if (fields.amountPaid !== undefined) updates.amount_paid = fields.amountPaid;
    if (fields.driverId) updates.driver_id = fields.driverId;
    if (fields.deliveryAddress) updates.delivery_address = fields.deliveryAddress;
    if (fields.deliveryNotes) updates.delivery_notes = fields.deliveryNotes;
    if (fields.preuvePaiementUrl) updates.payment_proof_url = fields.preuvePaiementUrl;
    if (fields.statutPaiement) updates.statut_paiement = fields.statutPaiement;

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

    const channel = supabase
      .channel("public:orders")
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
