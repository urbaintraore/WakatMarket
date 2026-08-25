import { Order, OrderStatus, Product, UserProfile } from "../types";
import { supabase, isNetworkError } from "../supabase";
import { orderToDb, orderFromDb } from "./dbMappers";
import { jsPDF } from "jspdf";

function mapRowToOrder(row: any): Order {
  return orderFromDb(row);
}

export const orderService = {
  /**
   * Générer une facture PDF pour une commande livrée
   */
  generateInvoicePDF(order: Order, products: Product[], users: UserProfile[]): void {
    if (!order) return;
    
    // Create new PDF doc in A4 portrait format
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Color palette - elegant charcoal and warm orange/zinc theme
    const primaryColor = [24, 24, 27]; // zinc-900 / anthracite
    const secondaryColor = [234, 88, 12]; // orange-600 (wakat accent)
    const grayColor = [113, 113, 122]; // zinc-500
    const lightBgColor = [244, 244, 245]; // zinc-100

    // Document styling helper
    const setFont = (style: "normal" | "bold" | "italic", size: number, color: number[]) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
    };

    // Header / Branding
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(0, 0, 210, 15, "F"); // Orange brand bar

    // WakatMarket Title / Logo text
    setFont("bold", 22, primaryColor);
    doc.text("WakatMarket ERP", 15, 30);
    
    setFont("normal", 8, grayColor);
    doc.text("Plateforme de commerce et de distribution B2B / B2C", 15, 35);

    // Invoice Meta (right aligned)
    setFont("bold", 14, secondaryColor);
    doc.text("FACTURE", 195, 30, { align: "right" });
    
    setFont("bold", 9, primaryColor);
    doc.text(`N°: ${order.id.substring(0, 8).toUpperCase()}`, 195, 36, { align: "right" });
    
    setFont("normal", 9, grayColor);
    const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : new Date().toLocaleDateString("fr-FR");
    doc.text(`Date: ${dateStr}`, 195, 42, { align: "right" });

    // Find profiles for Sender and Receiver
    const sender = users.find(u => u.id === order.senderId);
    const receiver = users.find(u => u.id === order.receiverId);

    // Coordinates for Party details
    const col1 = 15;
    const col2 = 110;
    let y = 55;

    // Party section title background
    doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
    doc.rect(15, y, 180, 7, "F");
    
    setFont("bold", 8, primaryColor);
    doc.text("ÉMETTEUR (Vendeur)", 18, y + 5);
    doc.text("DESTINATAIRE (Acheteur)", 113, y + 5);

    y += 12;

    // Sender details
    setFont("bold", 10, primaryColor);
    const senderName = (order as any).receiverName || receiver?.companyName || receiver?.name || "Vendeur Wakat";
    doc.text(senderName, col1, y);
    
    setFont("normal", 9, grayColor);
    const senderEmail = receiver?.email || "";
    const senderPhone = receiver?.phone || "";
    const senderCountryRegion = receiver ? `${receiver.region || ""}, ${receiver.country || ""}` : "";
    let senderOffset = 5;
    if (senderPhone) {
      doc.text(`Tél: ${senderPhone}`, col1, y + senderOffset);
      senderOffset += 5;
    }
    if (senderEmail) {
      doc.text(`Email: ${senderEmail}`, col1, y + senderOffset);
      senderOffset += 5;
    }
    if (senderCountryRegion.trim() !== ",") {
      doc.text(senderCountryRegion, col1, y + senderOffset);
    }

    // Receiver / Buyer details
    setFont("bold", 10, primaryColor);
    const receiverName = (order as any).senderName || sender?.companyName || sender?.name || "Acheteur Wakat";
    doc.text(receiverName, col2, y);

    setFont("normal", 9, grayColor);
    const receiverEmail = sender?.email || "";
    const receiverPhone = sender?.phone || "";
    const receiverCountryRegion = sender ? `${sender.region || ""}, ${sender.country || ""}` : "";
    let receiverOffset = 5;
    if (receiverPhone) {
      doc.text(`Tél: ${receiverPhone}`, col2, y + receiverOffset);
      receiverOffset += 5;
    }
    if (receiverEmail) {
      doc.text(`Email: ${receiverEmail}`, col2, y + receiverOffset);
      receiverOffset += 5;
    }
    if (receiverCountryRegion.trim() !== ",") {
      doc.text(receiverCountryRegion, col2, y + receiverOffset);
    }

    // Adjust y coordinate for Table
    y = 100;

    // Table Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, y, 180, 8, "F");

    setFont("bold", 9, [255, 255, 255]);
    doc.text("Désignation Produit", 18, y + 5.5);
    doc.text("P.U. (FCFA)", 110, y + 5.5, { align: "right" });
    doc.text("Qté", 145, y + 5.5, { align: "right" });
    doc.text("Total (FCFA)", 190, y + 5.5, { align: "right" });

    y += 8;

    // Table rows
    order.items.forEach((item, index) => {
      if (index % 2 === 1) {
        doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
        doc.rect(15, y, 180, 8, "F");
      }

      const prod = products.find(p => p.id === item.productId);
      const prodName = prod ? `${prod.name} (${prod.brand || ""})` : `Produit ID: ${item.productId.substring(0,6)}`;

      setFont("normal", 9, primaryColor);
      doc.text(prodName, 18, y + 5.5);
      doc.text((item.priceAtOrder || 0).toLocaleString("fr-FR"), 110, y + 5.5, { align: "right" });
      doc.text((item.quantity || 0).toString(), 145, y + 5.5, { align: "right" });
      
      const rowTotal = (item.priceAtOrder || 0) * (item.quantity || 0);
      doc.text(rowTotal.toLocaleString("fr-FR"), 190, y + 5.5, { align: "right" });

      y += 8;
    });

    // Divider line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(15, y + 2, 195, y + 2);

    y += 8;

    // Total section (right aligned)
    setFont("bold", 11, primaryColor);
    doc.text("Total Facture:", 145, y, { align: "right" });
    setFont("bold", 11, secondaryColor);
    doc.text(`${(order.totalAmount || 0).toLocaleString("fr-FR")} FCFA`, 190, y, { align: "right" });

    y += 6;

    setFont("normal", 9, grayColor);
    doc.text("Montant Payé:", 145, y, { align: "right" });
    setFont("normal", 9, primaryColor);
    doc.text(`${(order.amountPaid || 0).toLocaleString("fr-FR")} FCFA`, 190, y, { align: "right" });

    y += 6;

    const reste = Math.max(0, (order.totalAmount || 0) - (order.amountPaid || 0));
    setFont("bold", 9, primaryColor);
    doc.text("Reste à payer:", 145, y, { align: "right" });
    doc.text(`${reste.toLocaleString("fr-FR")} FCFA`, 190, y, { align: "right" });

    // Status / Signature Footer
    y = 230;
    
    // Delivered banner
    doc.setFillColor(220, 252, 231); // light emerald
    doc.rect(15, y, 180, 12, "F");
    
    setFont("bold", 10, [21, 128, 61]); // dark green
    doc.text("STATUT DE LA COMMANDE: LIVRÉE ET RÉCEPTIONNÉE", 20, y + 7.5);

    y += 22;

    // Signature Area
    setFont("normal", 8, grayColor);
    doc.text("Signature & Cachet du Fournisseur", 15, y);
    doc.text("Bon pour réception (Client)", 195, y, { align: "right" });

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(15, y + 15, 65, y + 15);
    doc.line(145, y + 15, 195, y + 15);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text("Merci pour votre confiance. Document généré numériquement via WakatMarket ERP.", 105, 285, { align: "center" });

    // Trigger PDF download
    doc.save(`Facture_Wakat_${order.id.substring(0, 8).toUpperCase()}.pdf`);
  },
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
        if (isNetworkError(error)) {
          console.warn("[orderService] Réseau Supabase indisponible pour getAllOrders (mode hors-ligne).");
        } else {
          console.error("Erreur getAllOrders Supabase:", error);
        }
        return [];
      }

      return (data || []).map(mapRowToOrder);
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("[orderService] Exception réseau getAllOrders (mode hors-ligne):", (err as any)?.message || err);
      } else {
        console.error("Exception dans getAllOrders:", err);
      }
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

