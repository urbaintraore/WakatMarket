import React, { useState, useMemo } from "react";
import { 
  User as UserIcon, Phone, Mail, ShoppingBag, DollarSign, PlusCircle, 
  ChevronDown, ChevronUp, Search, Calendar, CheckCircle, Clock, AlertTriangle,
  Download, FileText, Users, TrendingDown, AlertCircle, Eye, ArrowUpRight, Trash2
} from "lucide-react";
import { jsPDF } from "jspdf";
import { UserProfile, Order, DebtPayment, LightClient, Product } from "../types";
import { formatCFA } from "../data";
import { BuyerDetailModal } from "./BuyerDetailModal";
import { PartialPaymentModal } from "./PartialPaymentModal";
import { connectionService } from "../services/connectionService";

function getRemovedBuyerIds(currentUserId: string): Set<string> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(`wakat_deleted_buyers_${currentUserId}`) : null;
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
}

function saveRemovedBuyerId(currentUserId: string, buyerId: string) {
  try {
    if (typeof window === "undefined") return;
    const set = getRemovedBuyerIds(currentUserId);
    set.add(buyerId);
    localStorage.setItem(`wakat_deleted_buyers_${currentUserId}`, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

interface UnifiedBuyer {
  id: string; // User ID or LightClient ID
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  roleOrType: string;
  type: "PARTENAIRE" | "FIDÈLE"; // PARTENAIRE is real user, FIDÈLE is LightClient or local buyer
  isRealUser: boolean;
}

interface MyBuyersModuleProps {
  currentUser: UserProfile;
  users: UserProfile[];
  orders: Order[];
  payments: DebtPayment[];
  lightClients: LightClient[];
  products?: Product[];
  onAddPayment: (clientId: string, amount: number, orderId?: string, method?: string) => void;
  onUpdateCreditLimit?: (id: string, isRealUser: boolean, limit: number) => void;
  onCreateLightClient?: (identifier: string, notes?: string, role?: any, isPartnerRegistration?: boolean) => void;
  onDeleteLightClient?: (clientId: string) => void;
}

export function MyBuyersModule({
  currentUser,
  users,
  orders,
  payments,
  lightClients,
  products = [],
  onAddPayment,
  onUpdateCreditLimit,
  onCreateLightClient,
  onDeleteLightClient
}: MyBuyersModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBuyerId, setExpandedBuyerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "achats" | "reglements">>({});
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [newLimitValue, setNewLimitValue] = useState<string>("");
  const [activeMainTab, setActiveMainTab] = useState<"buyers" | "debts">("buyers");
  const [onlyShowDebtors, setOnlyShowDebtors] = useState<boolean>(true);
  const [debtSearchQuery, setDebtSearchQuery] = useState("");
  const [debtPaymentAmount, setDebtPaymentAmount] = useState<Record<string, string>>({});
  const [confirmDeleteBuyerId, setConfirmDeleteBuyerId] = useState<string | null>(null);
  const [deletedIdsCount, setDeletedIdsCount] = useState<number>(0);

  // Modals state for Buyer Details and Partial Payment Form
  const [selectedBuyerForDetail, setSelectedBuyerForDetail] = useState<UnifiedBuyer | null>(null);
  const [selectedInvoiceForPartialPayment, setSelectedInvoiceForPartialPayment] = useState<{ order: Order; buyerName: string } | null>(null);

  // Add buyer form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addIdentifier, setAddIdentifier] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addRole, setAddRole] = useState("CLIENT");
  const [addIsPartner, setAddIsPartner] = useState(false);

  const foundUser = useMemo(() => {
    if (!addIdentifier.trim()) return null;
    const trimmed = addIdentifier.trim().toLowerCase();
    const clean = trimmed.replace(/[\s\-\+]/g, "");
    return users.find((u) => {
      const uPhone = (u.phone || "").toLowerCase().replace(/[\s\-\+]/g, "");
      const uEmail = (u.email || "").toLowerCase();
      return (uPhone && uPhone === clean) || (uEmail && uEmail === trimmed);
    });
  }, [addIdentifier, users]);

  const handleAddNewBuyerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addIdentifier.trim()) {
      alert("Veuillez saisir un numéro de téléphone ou un e-mail.");
      return;
    }

    if (!onCreateLightClient) {
      alert("Fonctionnalité d'ajout d'acheteur indisponible sur ce tableau de bord.");
      return;
    }

    try {
      onCreateLightClient(addIdentifier.trim(), addNotes.trim() || undefined, addRole as any, addIsPartner);
      setAddIdentifier("");
      setAddNotes("");
      setAddIsPartner(false);
      setShowAddForm(false);
    } catch (err) {
      console.error("Error creating light client:", err);
      alert("Erreur lors de la création de l'acheteur.");
    }
  };

  const getBuyerCreditLimit = (buyer: UnifiedBuyer) => {
    if (buyer.isRealUser) {
      const u = users.find(x => x.id === buyer.id);
      return u?.creditLimit !== undefined ? u.creditLimit : 300000;
    } else {
      const lc = lightClients.find(x => x.id === buyer.id);
      return lc?.creditLimit !== undefined ? lc.creditLimit : 200000;
    }
  };

  const handleExportPDF = (order: Order) => {
    try {
      const doc = new jsPDF();
      
      const seller = users.find(u => u.id === order.receiverId) || currentUser;
      
      // The buyer in this case is the unified buyer we are expanding!
      const buyerName = unifiedBuyers.find(b => b.id === (order.senderId === currentUser.id ? order.clientId || order.receiverId : order.senderId))?.name 
        || users.find(u => u.id === order.senderId)?.name 
        || lightClients.find(lc => lc.id === order.clientId)?.name 
        || "Client";

      const buyerPhone = unifiedBuyers.find(b => b.id === (order.senderId === currentUser.id ? order.clientId || order.receiverId : order.senderId))?.phone
        || users.find(u => u.id === order.senderId)?.phone 
        || lightClients.find(lc => lc.id === order.clientId)?.phone 
        || "N/A";

      const buyerCompany = unifiedBuyers.find(b => b.id === (order.senderId === currentUser.id ? order.clientId || order.receiverId : order.senderId))?.companyName
        || users.find(u => u.id === order.senderId)?.companyName 
        || lightClients.find(lc => lc.id === order.clientId)?.notes 
        || "N/A";

      // Top Header accent bar
      doc.setFillColor(16, 185, 129); // Emerald-500
      doc.rect(0, 0, 210, 35, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("FACTURE COMMERCIALE / WAKAT ERP", 15, 22);

      // Metadata right-aligned
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`ID Facture: #${order.id.split('-').pop()?.toUpperCase()}`, 135, 15);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`, 135, 21);
      doc.text(`Statut: ${order.status}`, 135, 27);

      // Seller / Buyer Information Blocks
      doc.setTextColor(30, 41, 59); // zinc-800
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Vendeur :", 15, 52);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`${seller?.companyName || seller?.name || "Partenaire Wakat ERP"}`, 15, 58);
      doc.text(`Contact: ${seller?.phone || "N/A"}`, 15, 64);
      doc.text(`Localisation: ${seller?.region || "N/A"}, ${seller?.country || "Burkina Faso"}`, 15, 70);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Acheteur / Client :", 115, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`${buyerCompany !== "N/A" ? buyerCompany : buyerName}`, 115, 58);
      doc.text(`Nom de contact: ${buyerName}`, 115, 64);
      doc.text(`Contact: ${buyerPhone}`, 115, 70);
      doc.text(`Adresse de livraison: ${order.deliveryAddress || "Non spécifiée"}`, 115, 76);

      // Items Table Header
      doc.setFillColor(30, 41, 59); // Dark blue gray header
      doc.rect(15, 90, 180, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Désignation de l'Article", 18, 95.5);
      doc.text("Qté", 115, 95.5);
      doc.text("Prix Unit. (CFA)", 135, 95.5);
      doc.text("Total (CFA)", 165, 95.5);

      // Table Row Loop
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      let currentY = 105;
      order.items.forEach((item, index) => {
        const prod = products.find(p => p.id === item.productId);
        const prodName = prod ? prod.name : "Produit";
        const totalLine = item.quantity * item.priceAtOrder;

        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(15, currentY - 5, 180, 7, "F");
        }

        doc.text(prodName, 18, currentY);
        doc.text(item.quantity.toString(), 115, currentY);
        doc.text(`${item.priceAtOrder.toLocaleString()} FCFA`, 135, currentY);
        doc.text(`${totalLine.toLocaleString()} FCFA`, 165, currentY);

        currentY += 8;
      });

      // Horizontal separator line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(15, currentY + 2, 195, currentY + 2);

      // Totals and Summary Block
      currentY += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Frais de livraison :", 115, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(`${(order.shippingFee || 0).toLocaleString()} FCFA`, 165, currentY);

      currentY += 7;
      doc.setFont("helvetica", "bold");
      doc.text("Montant Global :", 115, currentY);
      doc.setTextColor(16, 185, 129); // Emerald color
      doc.text(`${order.totalAmount.toLocaleString()} FCFA`, 165, currentY);

      // Payment Status Badge
      currentY += 15;
      doc.setFillColor(order.paymentStatus === "PAID" ? 209 : 254, order.paymentStatus === "PAID" ? 250 : 226, order.paymentStatus === "PAID" ? 229 : 226); // emerald-100 or rose-100
      doc.rect(15, currentY - 6, 60, 8, "F");
      doc.setTextColor(order.paymentStatus === "PAID" ? 6 : 153, order.paymentStatus === "PAID" ? 95 : 27, order.paymentStatus === "PAID" ? 70 : 27); // emerald-700 or rose-700
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`PAIEMENT: ${order.paymentStatus === "PAID" ? "RÉGLÉ / PAYÉ" : "A CRÉDIT"}`, 18, currentY - 0.5);

      // Footer notice
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("Wakat ERP - Solution Intelligente de Gestion Commerciale des Chaines de Valeur", 15, 285);

      doc.save(`Facture_Wakat_${order.id.split('-').pop()?.toUpperCase()}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Erreur lors de la génération de la facture PDF.");
    }
  };

  // 1. Compute unified list of buyers
  const unifiedBuyers = useMemo(() => {
    const list: UnifiedBuyer[] = [];
    const removedIds = getRemovedBuyerIds(currentUser.id);
    const deletedConnIds = connectionService.getDeletedConnectionIds();
    const deletedPairs = connectionService.getDeletedPartnerPairs();

    const isBuyerForSeller = (sellerRole: string, buyerRole: string): boolean => {
      if (sellerRole === "ADMIN") return true;
      switch (sellerRole) {
        case "MANUFACTURER":
          return buyerRole === "WHOLESALER";
        case "WHOLESALER":
          return ["SEMI_WHOLESALER", "RETAILER"].includes(buyerRole);
        case "SEMI_WHOLESALER":
          return ["RETAILER", "CLIENT"].includes(buyerRole);
        case "RETAILER":
          return buyerRole === "CLIENT";
        default:
          return false;
      }
    };

    // A. Real users who have placed B2B orders with the currentUser OR are connected
    const realUserIds = new Set<string>();
    orders.forEach((o) => {
      if (o.receiverId === currentUser.id && o.senderId && o.senderId !== currentUser.id) {
        realUserIds.add(o.senderId);
      }
      if (o.senderId === currentUser.id && o.receiverId && o.receiverId !== "CASH_CLIENT" && o.receiverId !== currentUser.id) {
        realUserIds.add(o.receiverId);
      }
    });

    realUserIds.forEach((uid) => {
      if (removedIds.has(uid) || deletedConnIds.has(uid)) return;
      if (deletedPairs.has(`${currentUser.id}:${uid}`) || deletedPairs.has(`${uid}:${currentUser.id}`)) return;

      const u = users.find((profile) => profile.id === uid);
      if (u && isBuyerForSeller(currentUser.role, u.role)) {
        list.push({
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email,
          companyName: u.companyName,
          roleOrType: u.role === "SEMI_WHOLESALER" ? "Partenaire Demi-Grossiste" : (u.role === "RETAILER" ? "Partenaire Détaillant" : "Partenaire Client"),
          type: "PARTENAIRE",
          isRealUser: true
        });
      }
    });

    // B. LightClients (Clients locaux enregistrés)
    const myLightClients = lightClients.filter((lc) => lc.ownerId === currentUser.id);
    myLightClients.forEach((lc) => {
      if (removedIds.has(lc.id) || deletedConnIds.has(lc.id)) return;

      // If this light client has a linked real user, check if they are a buyer role
      if (lc.linkedUserId) {
        if (removedIds.has(lc.linkedUserId) || deletedConnIds.has(lc.linkedUserId)) return;
        if (deletedPairs.has(`${currentUser.id}:${lc.linkedUserId}`) || deletedPairs.has(`${lc.linkedUserId}:${currentUser.id}`)) return;

        const u = users.find((profile) => profile.id === lc.linkedUserId);
        if (u) {
          if (isBuyerForSeller(currentUser.role, u.role)) {
            // Ensure no duplicate
            if (!list.some((b) => b.id === u.id)) {
              list.push({
                id: u.id,
                name: u.name,
                phone: u.phone,
                email: u.email,
                companyName: u.companyName,
                roleOrType: u.role === "SEMI_WHOLESALER" ? "Partenaire Demi-Grossiste" : (u.role === "RETAILER" ? "Partenaire Détaillant" : "Partenaire Client"),
                type: "PARTENAIRE",
                isRealUser: true
              });
            }
          }
          return; // Skip adding as local faithful client if we successfully treated/filtered it
        }
      }

      // If not linked or no real user found, add as a local faithful buyer
      if (!list.some((b) => b.id === lc.id)) {
        list.push({
          id: lc.id,
          name: lc.name,
          phone: lc.phone,
          email: lc.email,
          companyName: lc.notes, // simple fallback
          roleOrType: "Client Fidèle (Crédit)",
          type: "FIDÈLE",
          isRealUser: false
        });
      }
    });

    const dedupedList: UnifiedBuyer[] = [];
    const seenKeys = new Set<string>();

    list.forEach(b => {
      const normEmail = b.email ? b.email.toLowerCase().trim() : "";
      const normCompany = b.companyName ? b.companyName.toLowerCase().trim() : "";
      
      const emailKey = normEmail ? `email:${normEmail}` : null;
      const companyKey = (normCompany && normCompany !== "entreprise") ? `company:${normCompany}` : null;
      const idKey = `id:${b.id}`;

      if (
        (emailKey && seenKeys.has(emailKey)) ||
        (companyKey && seenKeys.has(companyKey)) ||
        seenKeys.has(idKey)
      ) {
        return;
      }

      if (emailKey) seenKeys.add(emailKey);
      if (companyKey) seenKeys.add(companyKey);
      seenKeys.add(idKey);
      dedupedList.push(b);
    });

    return dedupedList;
  }, [currentUser, users, orders, lightClients, deletedIdsCount]);

  const handleDeleteBuyer = async (buyer: UnifiedBuyer) => {
    saveRemovedBuyerId(currentUser.id, buyer.id);
    if (buyer.isRealUser) {
      connectionService.saveDeletedPartnerPair(currentUser.id, buyer.id);
      connectionService.saveDeletedConnectionId(buyer.id);
      await connectionService.deleteConnection(buyer.id, currentUser.id, buyer.id);
    }
    if (onDeleteLightClient) {
      onDeleteLightClient(buyer.id);
    }
    setDeletedIdsCount(prev => prev + 1);
    setConfirmDeleteBuyerId(null);
    if (selectedBuyerForDetail?.id === buyer.id) {
      setSelectedBuyerForDetail(null);
    }
  };

  // 2. Filter buyers by search query
  const filteredBuyers = useMemo(() => {
    if (!searchQuery.trim()) return unifiedBuyers;
    const q = searchQuery.toLowerCase();
    return unifiedBuyers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.companyName && b.companyName.toLowerCase().includes(q)) ||
        b.phone.includes(q)
    );
  }, [unifiedBuyers, searchQuery]);

  // 3. Helper to get statistics for a single buyer
  const getBuyerStats = (buyerId: string) => {
    // Orders where this buyer is the sender OR receiver OR clientId
    const buyerOrders = orders.filter((o) => {
      // Must involve currentUser as seller
      const isSeller = o.senderId === currentUser.id || o.receiverId === currentUser.id;
      if (!isSeller) return false;

      // Identify if this order belongs to this buyer
      const isBuyerMatch = 
        o.senderId === buyerId || 
        o.receiverId === buyerId || 
        o.clientId === buyerId;
      return isBuyerMatch;
    });

    const totalPurchased = buyerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const amountPaidInOrders = buyerOrders.reduce((sum, o) => sum + o.amountPaid, 0);

    // Payments registered in DebtPayments
    const buyerPayments = payments.filter((p) => p.clientId === buyerId);
    const totalAdditionalPaid = buyerPayments.reduce((sum, p) => sum + p.amount, 0);

    // Total Paid = paid at order time + paid subsequently
    // Wait, the order might already contain the sum of its amountPaid.
    // If subsequent payments reduce remaining debt, does `amountPaid` in orders update?
    // In our system, subsequent payments are typically appended to `payments` list.
    // So: Outstanding Debt = Total Ordered - Total Paid At Order - Subsequent Payments
    const debt = Math.max(0, totalPurchased - amountPaidInOrders - totalAdditionalPaid);

    return {
      ordersCount: buyerOrders.length,
      totalPurchased,
      debt,
      orders: buyerOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      payments: buyerPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  };

  const handlePayDebt = (buyerId: string) => {
    const amtStr = paymentAmount[buyerId];
    if (!amtStr) return;
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) return;

    onAddPayment(buyerId, amount);
    setPaymentAmount((prev) => ({ ...prev, [buyerId]: "" }));
    alert(`Règlement de ${formatCFA(amount)} enregistré avec succès !`);
  };

  const handlePayDebtFromTracker = (buyerId: string) => {
    const amtStr = debtPaymentAmount[buyerId];
    if (!amtStr) return;
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) return;

    onAddPayment(buyerId, amount);
    setDebtPaymentAmount((prev) => ({ ...prev, [buyerId]: "" }));
    alert(`Règlement de ${formatCFA(amount)} enregistré avec succès !`);
  };

  const totalOutstandingDebts = useMemo(() => {
    return unifiedBuyers.reduce((sum, b) => sum + getBuyerStats(b.id).debt, 0);
  }, [unifiedBuyers, orders, payments]);

  const activeDebtorsCount = useMemo(() => {
    return unifiedBuyers.filter(b => getBuyerStats(b.id).debt > 0).length;
  }, [unifiedBuyers, orders, payments]);

  const debtFilteredBuyers = useMemo(() => {
    let list = unifiedBuyers;
    
    if (onlyShowDebtors) {
      list = list.filter(b => getBuyerStats(b.id).debt > 0);
    }
    
    if (debtSearchQuery.trim()) {
      const q = debtSearchQuery.toLowerCase();
      list = list.filter(
        b =>
          b.name.toLowerCase().includes(q) ||
          (b.companyName && b.companyName.toLowerCase().includes(q)) ||
          b.phone.includes(q)
      );
    }
    
    return list;
  }, [unifiedBuyers, onlyShowDebtors, debtSearchQuery, orders, payments]);

  return (
    <div className="space-y-4" id="my-buyers-module">
      {/* Module Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 pb-0.5 gap-2">
        <button
          onClick={() => setActiveMainTab("buyers")}
          className={`px-4 pb-2 text-xs font-black uppercase tracking-wider transition-all relative cursor-pointer ${
            activeMainTab === "buyers"
              ? "text-emerald-600 border-b-2 border-emerald-500 font-black"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Portefeuille Acheteurs
          </span>
        </button>
        <button
          onClick={() => setActiveMainTab("debts")}
          className={`px-4 pb-2 text-xs font-black uppercase tracking-wider transition-all relative cursor-pointer ${
            activeMainTab === "debts"
              ? "text-emerald-600 border-b-2 border-emerald-500 font-black"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            Suivi des Dettes ({unifiedBuyers.filter(b => getBuyerStats(b.id).debt > 0).length})
          </span>
        </button>
      </div>

      {activeMainTab === "buyers" ? (
        <div className="space-y-4">
          {/* Header Row: Search + Add Buyer button */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Rechercher un acheteur par nom, société, ou téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 transition shadow-inner"
              />
            </div>
            {onCreateLightClient && (
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  showAddForm
                    ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-505 shadow-sm shadow-emerald-600/10"
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                {showAddForm ? "Fermer" : "Nouvel Acheteur"}
              </button>
            )}
          </div>

          {/* Togglable add buyer form */}
          {showAddForm && onCreateLightClient && (
            <form 
              onSubmit={handleAddNewBuyerSubmit} 
              className="p-5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-150 dark:border-zinc-800 rounded-2xl space-y-4 animate-fade-in"
              id="add-buyer-form"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <h4 className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Ajouter un nouvel Acheteur
                </h4>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Compte Local & Partenaire</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Identifier Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    E-mail ou Téléphone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={addIdentifier}
                    onChange={(e) => setAddIdentifier(e.target.value)}
                    placeholder="Ex: +22670000000 ou acheteur@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[9.5px] text-zinc-400 font-semibold leading-snug">
                    Sera utilisé pour lier automatiquement un compte Wakat ERP existant ou pour créer un compte acheteur local.
                  </p>
                </div>

                {/* Notes Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Note ou Nom de l'Entreprise (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="Ex: Boutique Alerte, ou Nom de famille"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Real-time search/matching feedback inside the form */}
              {addIdentifier.trim() && (
                <div className="p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-800 text-xs">
                  {foundUser ? (
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 flex items-start gap-3 p-1 rounded-lg">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                        ✓
                      </div>
                      <div>
                        <p className="font-extrabold text-[10.5px] uppercase tracking-wider">Partenaire Certifié Wakat ERP Trouvé !</p>
                        <p className="font-semibold text-[11px] mt-0.5">
                          <strong>{foundUser.name}</strong> ({foundUser.companyName || "Sans entreprise"}) • Rôle : {foundUser.role}
                        </p>
                        <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-bold">
                          L'acheteur sera automatiquement connecté et lié à votre portefeuille de crédit.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50/60 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20 text-amber-800 dark:text-amber-400 flex items-start gap-3 p-1 rounded-lg">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 text-xs shrink-0">
                        ℹ
                      </div>
                      <div>
                        <p className="font-extrabold text-[10.5px] uppercase tracking-wider">Aucun profil public correspondant</p>
                        <p className="font-semibold text-[11px] mt-0.5">
                          Aucun utilisateur n'est actuellement inscrit avec cet identifiant.
                        </p>
                        <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1 font-bold">
                          Un acheteur local sécurisé ("Client Fidèle") sera automatiquement créé sous ce numéro/email.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced option toggles */}
              <div className="flex flex-col sm:flex-row gap-4 pt-1">
                <div className="flex items-center gap-2.5">
                  <input
                    id="add-is-partner"
                    type="checkbox"
                    checked={addIsPartner}
                    onChange={(e) => setAddIsPartner(e.target.checked)}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <label htmlFor="add-is-partner" className="text-xs text-zinc-600 dark:text-zinc-300 font-bold select-none cursor-pointer">
                    Enregistrer comme partenaire direct B2B
                  </label>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider whitespace-nowrap">
                    Rôle de l'Acheteur :
                  </label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="CLIENT">Détaillant / Client Standard</option>
                    <option value="RETAILER">Détaillant Agréé</option>
                    <option value="SEMI_WHOLESALER">Demi-Grossiste</option>
                    <option value="WHOLESALER">Grossiste Agréé</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/10 transition cursor-pointer"
                >
                  Ajouter l'Acheteur
                </button>
              </div>
            </form>
          )}

          {filteredBuyers.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs italic">
              Aucun acheteur enregistré ou ne correspond à la recherche.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredBuyers.map((buyer, idx) => {
                const stats = getBuyerStats(buyer.id);
                const isExpanded = expandedBuyerId === buyer.id;
                const subTab = activeSubTab[buyer.id] || "achats";

                return (
                  <div 
                    key={`fbuyer_${buyer.id}_${idx}`} 
                    className={`bg-white dark:bg-zinc-900 border rounded-2xl transition-all overflow-hidden ${
                      isExpanded 
                        ? "border-emerald-500 shadow-md ring-1 ring-emerald-500/10" 
                        : "border-zinc-150 dark:border-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    {/* Accordion Trigger Head */}
                    <div 
                      onClick={() => setExpandedBuyerId(isExpanded ? null : buyer.id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center font-bold shrink-0">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-zinc-950 dark:text-white truncate">
                              {buyer.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              buyer.type === "PARTENAIRE"
                                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30"
                                : "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/30"
                            }`}>
                              {buyer.roleOrType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-semibold mt-1">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {buyer.phone}</span>
                            {buyer.companyName && (
                              <span className="hidden sm:inline border-l border-zinc-200 dark:border-zinc-800 pl-3">
                                {buyer.companyName}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBuyerForDetail(buyer);
                              }}
                              className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md transition cursor-pointer"
                              title="Ouvrir la fiche signalétique et le bilan complet client"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Fiche Détaillée</span>
                            </button>

                            {confirmDeleteBuyerId === buyer.id ? (
                              <div className="ml-1.5 inline-flex items-center gap-1 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleDeleteBuyer(buyer);
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold shadow-sm"
                                  title="Confirmer la suppression"
                                >
                                  CONFIRMER
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteBuyerId(null);
                                  }}
                                  className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded text-[9px] font-bold"
                                  title="Annuler"
                                >
                                  ANNULER
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteBuyerId(buyer.id);
                                }}
                                className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/30 px-2 py-0.5 rounded-md transition cursor-pointer"
                                title="Supprimer / retirer ce partenaire ou client de votre carnet"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Supprimer</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Summary Badges */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                        <div className="flex gap-4">
                          <div className="text-right">
                            <p className="text-[9px] text-zinc-400 uppercase font-black tracking-wider">Cumul Achats</p>
                            <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 font-mono mt-0.5">{formatCFA(stats.totalPurchased)}</p>
                          </div>
                          <div className="text-right border-l border-zinc-100 dark:border-zinc-800 pl-4 flex flex-col items-end min-w-[120px]">
                            <p className="text-[9px] text-zinc-400 uppercase font-black tracking-wider">Crédit En Cours</p>
                            <p className={`text-xs font-black font-mono mt-0.5 ${stats.debt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
                              {formatCFA(stats.debt)}
                            </p>
                            {(() => {
                              const limit = getBuyerCreditLimit(buyer);
                              const percent = limit > 0 ? (stats.debt / limit) * 100 : 0;
                              const displayPercent = Math.min(100, percent);
                              
                              let barColorClass = "bg-emerald-500 dark:bg-emerald-400";
                              let textBgColorClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
                              if (percent >= 100) {
                                barColorClass = "bg-rose-600 dark:bg-rose-500";
                                textBgColorClass = "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
                              } else if (percent >= 80) {
                                barColorClass = "bg-amber-500 dark:bg-amber-400";
                                textBgColorClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
                              }

                              const limitFormatted = limit >= 1000000 
                                ? `${(limit / 1000000).toFixed(1)}M` 
                                : limit >= 1000 
                                  ? `${(limit / 1000).toFixed(0)}k` 
                                  : limit.toString();

                              return (
                                <div className="flex flex-col items-end w-full mt-1.5 space-y-1">
                                  {/* Visual Progress Bar (Jauge Visuelle) */}
                                  <div className="w-24 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200/20">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
                                      style={{ width: `${displayPercent}%` }}
                                    />
                                  </div>
                                  {/* Usage details label */}
                                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold">
                                    <span className={`px-1 rounded text-[8px] ${textBgColorClass}`}>
                                      {percent.toFixed(0)}%
                                    </span>
                                    <span className="text-zinc-400 dark:text-zinc-500 uppercase tracking-tight">
                                      Sur {limitFormatted}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ml-2">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Accordion Body Content */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 p-5 space-y-5 animate-fade-in">
                        
                        {/* Credit Limit Setting Card */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Limite de crédit autorisée</p>
                            {editingLimitId === buyer.id ? (
                              <div className="flex items-center gap-2 mt-1.5">
                                <input
                                  type="number"
                                  value={newLimitValue}
                                  onChange={(e) => setNewLimitValue(e.target.value)}
                                  className="w-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg py-1 px-2 text-xs font-bold"
                                  placeholder="Limite en CFA"
                                />
                                <button
                                  onClick={() => {
                                    const parsed = parseFloat(newLimitValue);
                                    if (!isNaN(parsed) && onUpdateCreditLimit) {
                                      onUpdateCreditLimit(buyer.id, buyer.isRealUser, parsed);
                                    }
                                    setEditingLimitId(null);
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                                >
                                  Enregistrer
                                </button>
                                <button
                                  onClick={() => setEditingLimitId(null)}
                                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 mt-1">
                                {formatCFA(getBuyerCreditLimit(buyer))}
                              </p>
                            )}
                          </div>
                          {editingLimitId !== buyer.id && onUpdateCreditLimit && (
                            <button
                              onClick={() => {
                                  setEditingLimitId(buyer.id);
                                  setNewLimitValue(getBuyerCreditLimit(buyer).toString());
                              }}
                              className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer"
                            >
                              Ajuster la limite
                            </button>
                          )}
                        </div>

                        {/* Visual Credit Gauge / Progress Bar */}
                        {(() => {
                          const limit = getBuyerCreditLimit(buyer);
                          const currentDebt = stats.debt;
                          const percent = limit > 0 ? Math.min(100, (currentDebt / limit) * 100) : 0;
                          
                          // Progress Bar Color-coding
                          let barColorClass = "bg-emerald-500 dark:bg-emerald-400";
                          let bgLightClass = "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30";
                          let textColorClass = "text-emerald-700 dark:text-emerald-300";
                          let indicatorLabel = "Marge disponible";
                          let indicatorValue = Math.max(0, limit - currentDebt);
                          let showWarning = false;

                          if (percent >= 100) {
                            barColorClass = "bg-rose-600 dark:bg-rose-500 animate-pulse";
                            bgLightClass = "bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30";
                            textColorClass = "text-rose-700 dark:text-rose-400 font-bold";
                            indicatorLabel = "Dépassement de limite";
                            indicatorValue = currentDebt - limit;
                            showWarning = true;
                          } else if (percent >= 80) {
                            barColorClass = "bg-amber-500 dark:bg-amber-400";
                            bgLightClass = "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30";
                            textColorClass = "text-amber-700 dark:text-amber-400 font-bold";
                            indicatorLabel = "Marge critique restante";
                            indicatorValue = limit - currentDebt;
                            showWarning = true;
                          }

                          return (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-xl space-y-3 shadow-sm">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">Utilisation du Crédit</span>
                                <span className={`font-black font-mono ${textColorClass}`}>
                                  {percent.toFixed(1)}%
                                </span>
                              </div>

                              {/* Progress bar container */}
                              <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200/10">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>

                              {/* Details & Status Card */}
                              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg border ${bgLightClass} text-xs`}>
                                <div className="space-y-0.5">
                                  <p className="text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[9px] font-bold">Encours Actuel / Limite</p>
                                  <p className="font-black text-zinc-800 dark:text-zinc-100">
                                    {formatCFA(currentDebt)} <span className="text-zinc-400 font-normal">sur</span> {formatCFA(limit)}
                                  </p>
                                </div>
                                <div className="sm:text-right space-y-0.5">
                                  <p className="text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[9px] font-bold">{indicatorLabel}</p>
                                  <p className={`font-black ${textColorClass}`}>
                                    {formatCFA(indicatorValue)}
                                  </p>
                                </div>
                              </div>

                              {showWarning && (
                                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider pt-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  {percent >= 100 
                                    ? "Bloqué ou dérogation requise pour les ventes futures" 
                                    : "Seuil d'alerte dépassé (>= 80%)"}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Inner Tabs for purchases history & payments list */}
                        <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2">
                          <div className="flex gap-4">
                            <button
                              onClick={() => setActiveSubTab((prev) => ({ ...prev, [buyer.id]: "achats" }))}
                              className={`text-xs font-bold pb-1 transition-all relative cursor-pointer ${
                                subTab === "achats"
                                  ? "text-emerald-600 border-b-2 border-emerald-500 font-black"
                                  : "text-zinc-400 hover:text-zinc-600"
                              }`}
                            >
                              Achats / Factures ({stats.ordersCount})
                            </button>
                            <button
                              onClick={() => setActiveSubTab((prev) => ({ ...prev, [buyer.id]: "reglements" }))}
                              className={`text-xs font-bold pb-1 transition-all relative cursor-pointer ${
                                subTab === "reglements"
                                  ? "text-emerald-600 border-b-2 border-emerald-500 font-black"
                                  : "text-zinc-400 hover:text-zinc-600"
                              }`}
                            >
                              Historique Règlements ({stats.payments.length})
                            </button>
                          </div>

                          {/* Debt repayment action widget */}
                          {stats.debt > 0 && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="Montant du règlement"
                                value={paymentAmount[buyer.id] || ""}
                                onChange={(e) => setPaymentAmount({ ...paymentAmount, [buyer.id]: e.target.value })}
                                className="w-28 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg py-1 px-2.5 text-xs font-bold text-right text-emerald-700"
                              />
                              <button
                                onClick={() => handlePayDebt(buyer.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1 px-3 rounded-lg flex items-center gap-1 transition cursor-pointer"
                              >
                                <PlusCircle className="w-3.5 h-3.5" /> Encaisser
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Active sub-tab rendering */}
                        {subTab === "achats" ? (
                          <div className="space-y-3">
                            {stats.orders.length === 0 ? (
                              <p className="text-zinc-400 italic text-center py-6 text-[11px]">Aucun achat enregistré pour le moment.</p>
                            ) : (
                              <div className="overflow-x-auto border border-zinc-150 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-800 text-[10px] text-zinc-400 font-black uppercase tracking-wider">
                                      <th className="py-3 px-4">Date</th>
                                      <th className="py-3 px-4">N° Facture</th>
                                      <th className="py-3 px-4">Méthode</th>
                                      <th className="py-3 px-4">Statut</th>
                                      <th className="py-3 px-4 text-right">Montant Global</th>
                                      <th className="py-3 px-4 text-center">Facture PDF</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {stats.orders.map((order, idx) => {
                                      return (
                                        <tr key={`buyer_order_${order.id}_${idx}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/25 transition-colors">
                                          <td className="py-3.5 px-4 font-semibold text-zinc-600 dark:text-zinc-400">
                                            {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                                          </td>
                                          <td className="py-3.5 px-4 font-bold text-zinc-800 dark:text-zinc-200">
                                            #{order.id.split('-').pop()?.toUpperCase()}
                                          </td>
                                          <td className="py-3.5 px-4 text-zinc-500 font-medium">
                                            {order.paymentMethod === "DEFERRED" ? "CRÉDIT / DIFFÉRÉ" : order.paymentMethod || "N/A"}
                                          </td>
                                          <td className="py-3.5 px-4">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${
                                              order.paymentStatus === "PAID"
                                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20"
                                                : (order.paymentStatus === "PARTIAL" ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20" : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20")
                                            }`}>
                                              {order.paymentStatus === "PAID" ? "PAYÉ" : (order.paymentStatus === "PARTIAL" ? "PARTIEL" : "À CRÉDIT")}
                                            </span>
                                          </td>
                                          <td className="py-3.5 px-4 text-right font-black font-mono text-zinc-800 dark:text-white">
                                            {formatCFA(order.totalAmount)}
                                          </td>
                                          <td className="py-3.5 px-4 text-center">
                                            <button
                                              onClick={() => handleExportPDF(order)}
                                              className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-400 font-bold py-1.5 px-3 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer"
                                              title="Télécharger la facture PDF officielle"
                                            >
                                              <Download className="w-3.5 h-3.5" />
                                              <span>Télécharger</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {stats.payments.length === 0 ? (
                              <p className="text-zinc-400 italic text-center py-6 text-[11px]">Aucun règlement enregistré pour le moment.</p>
                            ) : (
                              stats.payments.map((p, idx) => (
                                <div key={`buyer_pay_${p.id}_${idx}`} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3 rounded-xl flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <div>
                                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Encaissé</p>
                                      <p className="text-[10px] text-zinc-400">{new Date(p.date).toLocaleString()}</p>
                                    </div>
                                  </div>
                                  <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 font-mono">+{formatCFA(p.amount)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4" id="suivi-des-dettes">
          {/* Global Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Total des Créances</p>
                <p className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">{formatCFA(totalOutstandingDebts)}</p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Débiteurs Actifs</p>
                <p className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">{activeDebtorsCount} acheteur(s)</p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Crédit Moyen</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {formatCFA(activeDebtorsCount > 0 ? totalOutstandingDebts / activeDebtorsCount : 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Filtering & Search Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Rechercher un débiteur par son nom ou téléphone..."
                value={debtSearchQuery}
                onChange={(e) => setDebtSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 transition shadow-inner"
              />
            </div>
            
            <label className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-350 cursor-pointer select-none shrink-0 shadow-sm">
              <input
                type="checkbox"
                checked={onlyShowDebtors}
                onChange={(e) => setOnlyShowDebtors(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Afficher uniquement les débiteurs</span>
            </label>
          </div>

          {/* List of Debtors/Buyers */}
          {debtFilteredBuyers.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs italic">
              Aucun débiteur trouvé ou ne correspond aux filtres.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {debtFilteredBuyers.map((buyer, idx) => {
                const stats = getBuyerStats(buyer.id);
                const limit = getBuyerCreditLimit(buyer);
                const percent = limit > 0 ? Math.min(100, (stats.debt / limit) * 100) : 0;
                
                // Get unpaid/partially paid invoices for this buyer specifically
                const unpaidInvoices = stats.orders.filter(
                  o => o.paymentStatus !== "PAID" && (o.totalAmount - o.amountPaid) > 0
                );

                return (
                  <div 
                    key={`debt_buyer_${buyer.id}_${idx}`}
                    className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-750 transition"
                  >
                    {/* Header info of debtor partner */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 rounded-lg flex items-center justify-center shrink-0 border border-zinc-200/20">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-zinc-900 dark:text-white">{buyer.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              {buyer.roleOrType}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-zinc-400" /> {buyer.phone}
                            {buyer.companyName && <span className="text-zinc-300">|</span>}
                            {buyer.companyName && <span className="text-zinc-400">{buyer.companyName}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Outstanding Debt and repayment form */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 sm:text-right">
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase font-black tracking-wider">Cumul Crédit En Cours</p>
                          <p className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                            {formatCFA(stats.debt)}
                          </p>
                        </div>

                        {/* Partial Payment input & Action */}
                        <div className="flex items-center gap-2 border-l border-zinc-100 dark:border-zinc-800 pl-0 sm:pl-4">
                          <input
                            type="number"
                            placeholder="Montant du versement"
                            value={debtPaymentAmount[buyer.id] || ""}
                            onChange={(e) => setDebtPaymentAmount({ ...debtPaymentAmount, [buyer.id]: e.target.value })}
                            className="w-28 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs font-bold text-right text-emerald-700"
                          />
                          <button
                            onClick={() => handlePayDebtFromTracker(buyer.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center gap-1 transition shrink-0 cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" /> Encaisser partiel
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Credit Limit Gauge progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                        <span>Encours de crédit autorisé ({percent.toFixed(1)}% utilisé)</span>
                        <span>Limite: {formatCFA(limit)}</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200/10">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 100 
                              ? "bg-rose-500" 
                              : percent >= 80 
                                ? "bg-amber-500" 
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Unpaid / Outstanding Invoices (Factures Impayées) */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Factures Impayées</p>
                      
                      {unpaidInvoices.length === 0 ? (
                        <div className="bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100/30 text-[11px] text-emerald-600 dark:text-emerald-400 p-3 rounded-xl italic">
                          Toutes les factures pour cet acheteur sont entièrement réglées. (Aucun impayé actif).
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-zinc-150 dark:border-zinc-850 rounded-xl bg-zinc-50/20 dark:bg-zinc-950/10">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-850 text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3">Réf Facture</th>
                                <th className="py-2.5 px-3">Montant Global</th>
                                <th className="py-2.5 px-3">Déjà Réglé (Commande)</th>
                                <th className="py-2.5 px-3">Solde Restant</th>
                                <th className="py-2.5 px-3">Statut</th>
                                <th className="py-2.5 px-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                              {unpaidInvoices.map((order, idx) => {
                                const remainingAmount = order.totalAmount - order.amountPaid;
                                return (
                                  <tr key={`unpaid_ord_${order.id}_${idx}`} className="hover:bg-zinc-100/30 dark:hover:bg-zinc-950/20 transition-colors">
                                    <td className="py-2.5 px-3 text-zinc-500 font-medium">
                                      {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-zinc-800 dark:text-zinc-200">
                                      #{order.id.split('-').pop()?.toUpperCase()}
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                                      {formatCFA(order.totalAmount)}
                                    </td>
                                    <td className="py-2.5 px-3 text-zinc-500 font-mono">
                                      {formatCFA(order.amountPaid)}
                                    </td>
                                    <td className="py-2.5 px-3 font-black text-rose-600 dark:text-rose-400 font-mono">
                                      {formatCFA(remainingAmount)}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-black ${
                                        order.paymentStatus === "PARTIAL"
                                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100/20"
                                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/20"
                                      }`}>
                                        {order.paymentStatus === "PARTIAL" ? "PARTIEL" : "À CRÉDIT"}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => setSelectedInvoiceForPartialPayment({ order, buyerName: buyer.name })}
                                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded-md text-[10px] transition cursor-pointer shadow-sm"
                                          title="Enregistrer un règlement partiel pour cette facture"
                                        >
                                          <DollarSign className="w-3 h-3" />
                                          <span>Régler</span>
                                        </button>
                                        <button
                                          onClick={() => handleExportPDF(order)}
                                          className="inline-flex items-center gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-1.5 rounded-md transition cursor-pointer"
                                          title="Télécharger la facture PDF officielle"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                          <span className="text-[10px] font-bold">PDF</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Render Buyer Detail Modal */}
      {selectedBuyerForDetail && (
        <BuyerDetailModal
          buyer={selectedBuyerForDetail}
          currentUser={currentUser}
          users={users}
          orders={orders}
          payments={payments}
          lightClients={lightClients}
          products={products}
          isOpen={true}
          onClose={() => setSelectedBuyerForDetail(null)}
          onSubmitPayment={(clientId, amount, orderId, method) => {
            onAddPayment(clientId, amount, orderId, method);
          }}
          onUpdateCreditLimit={onUpdateCreditLimit}
        />
      )}

      {/* Render Standalone Partial Payment Modal */}
      {selectedInvoiceForPartialPayment && (
        <PartialPaymentModal
          order={selectedInvoiceForPartialPayment.order}
          buyerName={selectedInvoiceForPartialPayment.buyerName}
          isOpen={true}
          onClose={() => setSelectedInvoiceForPartialPayment(null)}
          onSubmitPayment={(clientId, amount, orderId, method) => {
            onAddPayment(clientId, amount, orderId, method);
            setSelectedInvoiceForPartialPayment(null);
          }}
        />
      )}
    </div>
  );
}
