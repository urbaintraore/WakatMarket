import React, { useState, useMemo } from "react";
import { 
  User as UserIcon, Phone, Mail, ShoppingBag, DollarSign, PlusCircle, 
  ChevronDown, ChevronUp, Search, Calendar, CheckCircle, Clock, AlertTriangle,
  Download, FileText
} from "lucide-react";
import { jsPDF } from "jspdf";
import { UserProfile, Order, DebtPayment, LightClient, Product } from "../types";
import { formatCFA } from "../data";

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
  onAddPayment: (clientId: string, amount: number) => void;
  onUpdateCreditLimit?: (id: string, isRealUser: boolean, limit: number) => void;
}

export function MyBuyersModule({
  currentUser,
  users,
  orders,
  payments,
  lightClients,
  products = [],
  onAddPayment,
  onUpdateCreditLimit
}: MyBuyersModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBuyerId, setExpandedBuyerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "achats" | "reglements">>({});
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [newLimitValue, setNewLimitValue] = useState<string>("");

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
      const u = users.find((profile) => profile.id === uid);
      if (u) {
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
      // Avoid duplicate if linked to a real user we already listed
      if (lc.linkedUserId && list.some((b) => b.id === lc.linkedUserId)) {
        return;
      }
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
    });

    return list;
  }, [currentUser, users, orders, lightClients]);

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

  return (
    <div className="space-y-4" id="my-buyers-module">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Rechercher un acheteur par nom, société, ou téléphone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 transition shadow-inner"
        />
      </div>

      {filteredBuyers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs italic">
          Aucun acheteur enregistré ou ne correspond à la recherche.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredBuyers.map((buyer) => {
            const stats = getBuyerStats(buyer.id);
            const isExpanded = expandedBuyerId === buyer.id;
            const subTab = activeSubTab[buyer.id] || "achats";

            return (
              <div 
                key={buyer.id} 
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
                      <div className="text-right border-l border-zinc-100 dark:border-zinc-800 pl-4 flex flex-col items-end">
                        <p className="text-[9px] text-zinc-400 uppercase font-black tracking-wider">Crédit En Cours</p>
                        <p className={`text-xs font-black font-mono mt-0.5 ${stats.debt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
                          {formatCFA(stats.debt)}
                        </p>
                        {stats.debt > 0 && (
                          <div className="w-16 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden border border-zinc-200/20">
                            <div 
                              className={`h-full rounded-full ${
                                (stats.debt / getBuyerCreditLimit(buyer)) >= 1 
                                  ? "bg-rose-500" 
                                  : (stats.debt / getBuyerCreditLimit(buyer)) >= 0.8 
                                    ? "bg-amber-500" 
                                    : "bg-emerald-500"
                              }`} 
                              style={{ width: `${Math.min(100, (stats.debt / getBuyerCreditLimit(buyer)) * 100)}%` }}
                            />
                          </div>
                        )}
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
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition"
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={() => setEditingLimitId(null)}
                              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition"
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
                          className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/20"
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
                          className={`text-xs font-bold pb-1 transition-all relative ${
                            subTab === "achats"
                              ? "text-emerald-600 border-b-2 border-emerald-500 font-black"
                              : "text-zinc-400 hover:text-zinc-600"
                          }`}
                        >
                          Achats / Factures ({stats.ordersCount})
                        </button>
                        <button
                          onClick={() => setActiveSubTab((prev) => ({ ...prev, [buyer.id]: "reglements" }))}
                          className={`text-xs font-bold pb-1 transition-all relative ${
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
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1 px-3 rounded-lg flex items-center gap-1 transition"
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
                                {stats.orders.map((order) => {
                                  return (
                                    <tr key={order.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/25 transition-colors">
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
                          stats.payments.map((p) => (
                            <div key={p.id} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3 rounded-xl flex justify-between items-center">
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
  );
}
