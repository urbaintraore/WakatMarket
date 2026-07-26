import React, { useState, useMemo } from "react";
import { 
  X, User as UserIcon, Phone, Mail, Building2, MapPin, Calendar, 
  CreditCard, DollarSign, FileText, Download, CheckCircle2, Clock, 
  AlertTriangle, PlusCircle, ArrowUpRight, TrendingUp, ShieldAlert,
  Search, Filter, RefreshCw
} from "lucide-react";
import { jsPDF } from "jspdf";
import { UserProfile, Order, DebtPayment, LightClient, Product } from "../types";
import { formatCFA } from "../data";
import { billingService } from "../services/billingService";
import { PartialPaymentModal } from "./PartialPaymentModal";

interface UnifiedBuyer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  roleOrType: string;
  type: "PARTENAIRE" | "FIDÈLE";
  isRealUser: boolean;
  notes?: string;
}

interface BuyerDetailModalProps {
  buyer: UnifiedBuyer;
  currentUser: UserProfile;
  users: UserProfile[];
  orders: Order[];
  payments: DebtPayment[];
  lightClients: LightClient[];
  products?: Product[];
  isOpen: boolean;
  onClose: () => void;
  onSubmitPayment: (clientId: string, amount: number, orderId?: string, method?: string) => void;
  onUpdateCreditLimit?: (id: string, isRealUser: boolean, limit: number) => void;
}

export function BuyerDetailModal({
  buyer,
  currentUser,
  users,
  orders,
  payments,
  lightClients,
  products = [],
  isOpen,
  onClose,
  onSubmitPayment,
  onUpdateCreditLimit
}: BuyerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"fiche" | "credit" | "factures" | "impayes" | "paiements">("fiche");
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Order | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState<string>("");

  if (!isOpen) return null;

  // Find underlying user or lightclient details
  const realUser = buyer.isRealUser ? users.find((u) => u.id === buyer.id) : null;
  const lightClient = !buyer.isRealUser ? lightClients.find((lc) => lc.id === buyer.id) : null;

  // Credit limit calculation
  const defaultLimit = 300000; // 300,000 CFA default
  const creditLimit = realUser 
    ? (realUser.creditLimit !== undefined ? realUser.creditLimit : defaultLimit)
    : (lightClient && lightClient.creditLimit !== undefined ? lightClient.creditLimit : defaultLimit);

  // Buyer orders and payments calculations
  const buyerOrders = useMemo(() => {
    return orders.filter((o) => {
      const isSeller = o.senderId === currentUser.id || o.receiverId === currentUser.id;
      if (!isSeller) return false;
      return (
        o.senderId === buyer.id ||
        o.receiverId === buyer.id ||
        o.clientId === buyer.id
      );
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, buyer.id, currentUser.id]);

  const totalPurchased = buyerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const amountPaidAtOrder = buyerOrders.reduce((sum, o) => sum + o.amountPaid, 0);

  // Direct registered payments
  const buyerPayments = useMemo(() => {
    return payments
      .filter((p) => p.clientId === buyer.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, buyer.id]);

  const totalAdditionalPaid = buyerPayments.reduce((sum, p) => sum + p.amount, 0);

  // Unpaid invoices
  const unpaidInvoices = buyerOrders.filter(
    (o) => o.amountPaid < o.totalAmount || o.paymentStatus === "PARTIAL" || o.paymentStatus === "PENDING"
  );

  const totalUnpaidDebt = Math.max(0, buyerOrders.reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0));
  const availableCredit = Math.max(0, creditLimit - totalUnpaidDebt);
  const creditPercent = creditLimit > 0 ? Math.min(100, Math.round((totalUnpaidDebt / creditLimit) * 100)) : 0;

  // Filtered invoices for tab 3
  const filteredInvoices = buyerOrders.filter((o) => {
    if (invoiceFilter === "UNPAID") return o.amountPaid < o.totalAmount;
    if (invoiceFilter === "PAID") return o.amountPaid >= o.totalAmount;
    return true;
  });

  const handleSaveLimit = () => {
    const val = parseFloat(limitInput);
    if (!isNaN(val) && val >= 0 && onUpdateCreditLimit) {
      onUpdateCreditLimit(buyer.id, buyer.isRealUser, val);
      setIsEditingLimit(false);
    }
  };

  const handleExportPDFInvoice = async (order: Order) => {
    try {
      const pdfUrl = await billingService.genererEtEnregistrerFacture({
        venteId: order.id,
        acheteurNom: buyer.name,
        vendeurNom: currentUser.companyName || currentUser.name,
        dateISO: order.createdAt,
        articles: order.items.map((it) => {
          const p = products.find((prod) => prod.id === it.productId);
          return {
            designation: p?.name || "Produit WakatMarket",
            quantite: it.quantity,
            prixUnitaire: it.priceAtOrder,
            montantTotal: it.quantity * it.priceAtOrder,
          };
        }),
        sousTotal: order.totalAmount,
        fraisLivraison: order.shippingFee || 0,
        montantTotal: order.totalAmount + (order.shippingFee || 0),
        montantPaye: order.amountPaid,
        soldeRestant: Math.max(0, order.totalAmount - order.amountPaid),
        modePaiement: order.paymentMethod,
      });

      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `Facture_Wakat_${order.id.split('-').pop()?.toUpperCase()}.pdf`;
      link.click();
    } catch (e) {
      console.error("PDF generation error:", e);
      alert("Erreur lors de la génération de la facture PDF.");
    }
  };

  const handleExportAccountStatement = () => {
    const doc = new jsPDF();
    doc.setFillColor(16, 185, 129); // Emerald
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("WakatMarket - Relevé de Compte Client", 14, 18);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Acheteur : ${buyer.name} (${buyer.companyName || "Client"})`, 14, 38);
    doc.text(`Téléphone : ${buyer.phone}`, 14, 44);
    doc.text(`Date d'émission : ${new Date().toLocaleDateString("fr-FR")}`, 14, 50);

    doc.setFont("helvetica", "bold");
    doc.text(`Plafond de Crédit : ${formatCFA(creditLimit)}`, 140, 38);
    doc.text(`Dette Globale : ${formatCFA(totalUnpaidDebt)}`, 140, 44);
    doc.text(`Crédit Disponible : ${formatCFA(availableCredit)}`, 140, 50);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 56, 196, 56);

    doc.setFontSize(12);
    doc.text("Historique Financier & Factures", 14, 66);

    let y = 76;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Date", 14, y);
    doc.text("Réf Facture", 45, y);
    doc.text("Montant Total", 90, y);
    doc.text("Déjà Réglé", 130, y);
    doc.text("Solde Dû", 170, y);

    y += 4;
    doc.line(14, y, 196, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    buyerOrders.forEach((o) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(new Date(o.createdAt).toLocaleDateString("fr-FR"), 14, y);
      doc.text(`#${o.id.split("-").pop()?.toUpperCase()}`, 45, y);
      doc.text(formatCFA(o.totalAmount), 90, y);
      doc.text(formatCFA(o.amountPaid), 130, y);
      doc.text(formatCFA(o.totalAmount - o.amountPaid), 170, y);
      y += 6;
    });

    doc.save(`Releve_Compte_${buyer.name.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Title Banner */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-zinc-900 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-xl shadow-inner">
              {buyer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">{buyer.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  buyer.isRealUser 
                    ? "bg-emerald-400 text-emerald-950" 
                    : "bg-amber-400 text-amber-950"
                }`}>
                  {buyer.type}
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                {buyer.companyName || "Acheteur WakatMarket"} — {buyer.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAccountStatement}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Télécharger le relevé de compte complet PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Relevé Client PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 px-4 pt-2 gap-1 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab("fiche")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition cursor-pointer ${
              activeTab === "fiche"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 border-t-2 border-emerald-500 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            Fiche Signalétique
          </button>
          <button
            onClick={() => setActiveTab("credit")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "credit"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 border-t-2 border-emerald-500 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            Jauge de Crédit
            {totalUnpaidDebt > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("factures")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition cursor-pointer ${
              activeTab === "factures"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 border-t-2 border-emerald-500 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            Factures ({buyerOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("impayes")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "impayes"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 border-t-2 border-emerald-500 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            Suivi Impayés ({unpaidInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab("paiements")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition cursor-pointer ${
              activeTab === "paiements"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 border-t-2 border-emerald-500 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            Paiements ({buyerPayments.length})
          </button>
        </div>

        {/* Modal Main Content View */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: FICHE SIGNALÉTIQUE */}
          {activeTab === "fiche" && (
            <div className="space-y-6">
              
              {/* Profile Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Identité & Contact</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-bold">
                      <UserIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{buyer.name}</span>
                    </div>
                    {buyer.companyName && (
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Société: {buyer.companyName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-mono">
                      <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{buyer.phone}</span>
                    </div>
                    {buyer.email && (
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{buyer.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Statut & Localisation</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>
                        {realUser ? `${realUser.commune || realUser.region || "Burkina Faso"} (${realUser.country})` : "Client Local / Boutique"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Rôle: {buyer.roleOrType}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Compte: {buyer.isRealUser ? "Inscrit sur WakatMarket" : "Enregistré Localement"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
                  <p className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Achats Cumulés</p>
                  <p className="text-base font-black text-emerald-900 dark:text-emerald-200 font-mono mt-0.5">{formatCFA(totalPurchased)}</p>
                </div>
                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-2xl">
                  <p className="text-[9px] uppercase font-bold text-rose-700 dark:text-rose-400">Dette En Cours</p>
                  <p className="text-base font-black text-rose-900 dark:text-rose-200 font-mono mt-0.5">{formatCFA(totalUnpaidDebt)}</p>
                </div>
                <div className="p-3.5 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 rounded-2xl">
                  <p className="text-[9px] uppercase font-bold text-teal-700 dark:text-teal-400">Total Encaissé</p>
                  <p className="text-base font-black text-teal-900 dark:text-teal-200 font-mono mt-0.5">{formatCFA(amountPaidAtOrder + totalAdditionalPaid)}</p>
                </div>
                <div className="p-3.5 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl">
                  <p className="text-[9px] uppercase font-bold text-zinc-500">Plafond Crédit</p>
                  <p className="text-base font-black text-zinc-900 dark:text-white font-mono mt-0.5">{formatCFA(creditLimit)}</p>
                </div>
              </div>

              {buyer.notes && (
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Notes & Remarques</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 italic">{buyer.notes}</p>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: JAUGE DE CRÉDIT */}
          {activeTab === "credit" && (
            <div className="space-y-6">
              
              {/* Visual Credit Gauge Card */}
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white">Jauge & Risque de Crédit</h3>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    creditPercent >= 100 
                      ? "bg-rose-500 text-white animate-pulse" 
                      : creditPercent >= 80 
                        ? "bg-amber-500 text-white" 
                        : "bg-emerald-600 text-white"
                  }`}>
                    {creditPercent >= 100 ? "Plafond Dépassé / Bloqué" : creditPercent >= 80 ? "Risque Élevé" : "Risque Faible"}
                  </span>
                </div>

                {/* Visual Bar Gauge */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-500">Dette Actuelle: <strong className="text-rose-600 font-mono">{formatCFA(totalUnpaidDebt)}</strong></span>
                    <span className="text-zinc-500">Plafond Intelligente: <strong className="text-zinc-900 dark:text-white font-mono">{formatCFA(creditLimit)}</strong></span>
                  </div>

                  <div className="w-full h-4 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-300/40">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        creditPercent >= 100 
                          ? "bg-rose-600" 
                          : creditPercent >= 80 
                            ? "bg-amber-500" 
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${creditPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                    <span>0 CFA</span>
                    <span>Utilisé: {creditPercent}%</span>
                    <span>Dispo: {formatCFA(availableCredit)}</span>
                  </div>
                </div>

                {/* Edit Credit Limit Controls */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Ajuster le Plafond de Crédit</p>
                    <p className="text-[10px] text-zinc-400">Modifiez la limite autorisée pour cet acheteur</p>
                  </div>

                  {!isEditingLimit ? (
                    <button
                      onClick={() => {
                        setIsEditingLimit(true);
                        setLimitInput(creditLimit.toString());
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white text-xs font-bold text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
                    >
                      Modifier la Limite
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        className="w-32 px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold"
                        placeholder="Ex: 500000"
                      />
                      <button
                        onClick={handleSaveLimit}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setIsEditingLimit(false)}
                        className="px-2 py-1 bg-zinc-300 dark:bg-zinc-700 text-xs rounded-lg cursor-pointer"
                      >
                        X
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: HISTORIQUE COMPLET DES FACTURES */}
          {activeTab === "factures" && (
            <div className="space-y-4">
              
              {/* Filter controls */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setInvoiceFilter("ALL")}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      invoiceFilter === "ALL" ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                    }`}
                  >
                    Toutes ({buyerOrders.length})
                  </button>
                  <button
                    onClick={() => setInvoiceFilter("UNPAID")}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      invoiceFilter === "UNPAID" ? "bg-rose-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                    }`}
                  >
                    Impayées ({unpaidInvoices.length})
                  </button>
                  <button
                    onClick={() => setInvoiceFilter("PAID")}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      invoiceFilter === "PAID" ? "bg-emerald-700 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                    }`}
                  >
                    Payées ({buyerOrders.length - unpaidInvoices.length})
                  </button>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-3 px-3.5">Date</th>
                      <th className="py-3 px-3.5">N° Facture</th>
                      <th className="py-3 px-3.5">Montant Total</th>
                      <th className="py-3 px-3.5">Réglé</th>
                      <th className="py-3 px-3.5">Reste Dû</th>
                      <th className="py-3 px-3.5">Statut</th>
                      <th className="py-3 px-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-400 italic">
                          Aucune facture trouvée pour ce critère.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((order) => {
                        const remaining = Math.max(0, order.totalAmount - order.amountPaid);
                        const isPaid = remaining === 0;

                        return (
                          <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors">
                            <td className="py-3 px-3.5 text-zinc-500 font-medium">
                              {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="py-3 px-3.5 font-bold text-zinc-900 dark:text-white">
                              #{order.id.split('-').pop()?.toUpperCase()}
                            </td>
                            <td className="py-3 px-3.5 font-bold text-zinc-900 dark:text-white font-mono">
                              {formatCFA(order.totalAmount)}
                            </td>
                            <td className="py-3 px-3.5 text-emerald-600 dark:text-emerald-400 font-mono">
                              {formatCFA(order.amountPaid)}
                            </td>
                            <td className={`py-3 px-3.5 font-mono font-bold ${remaining > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-400"}`}>
                              {formatCFA(remaining)}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                isPaid 
                                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                                  : order.amountPaid > 0 
                                    ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
                                    : "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300"
                              }`}>
                                {isPaid ? "PAYÉ" : order.amountPaid > 0 ? "PARTIEL" : "À CRÉDIT"}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleExportPDFInvoice(order)}
                                  className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition cursor-pointer"
                                  title="Télécharger Facture PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                {!isPaid && (
                                  <button
                                    onClick={() => setSelectedInvoiceForPayment(order)}
                                    className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-500 transition cursor-pointer"
                                  >
                                    Régler
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 4: SUIVI DES DETTES IMPAYÉES */}
          {activeTab === "impayes" && (
            <div className="space-y-4">
              
              <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-rose-900 dark:text-rose-200">Factures Impayées Actives</h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300">Solde global impayé dû par cet acheteur : <strong className="font-mono">{formatCFA(totalUnpaidDebt)}</strong></p>
                </div>
              </div>

              {unpaidInvoices.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/40 rounded-2xl text-emerald-600 text-xs font-semibold">
                  Toutes les factures de cet acheteur sont entièrement soldées. Aucun impayé actif.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unpaidInvoices.map((order) => {
                    const remaining = order.totalAmount - order.amountPaid;
                    return (
                      <div key={order.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-zinc-900 dark:text-white">
                            Facture #{order.id.split('-').pop()?.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-semibold">
                            {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                          <div>
                            <p className="text-[9px] uppercase text-zinc-400">Total</p>
                            <p className="text-xs font-bold font-mono">{formatCFA(order.totalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase text-zinc-400">Payé</p>
                            <p className="text-xs font-bold text-emerald-600 font-mono">{formatCFA(order.amountPaid)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase text-zinc-400">Reste Dû</p>
                            <p className="text-xs font-black text-rose-600 font-mono">{formatCFA(remaining)}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedInvoiceForPayment(order)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Enregistrer un Règlement Partiel</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 5: HISTORIQUE DES PAIEMENTS */}
          {activeTab === "paiements" && (
            <div className="space-y-4">
              
              <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-3 px-3.5">Date & Heure</th>
                      <th className="py-3 px-3.5">Montant Encaissé</th>
                      <th className="py-3 px-3.5">Facture / Vente Cible</th>
                      <th className="py-3 px-3.5">Statut Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                    {buyerPayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-zinc-400 italic">
                          Aucun règlement enregistré dans l'historique financier.
                        </td>
                      </tr>
                    ) : (
                      buyerPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors">
                          <td className="py-3 px-3.5 text-zinc-500 font-medium">
                            {new Date(p.date).toLocaleString("fr-FR")}
                          </td>
                          <td className="py-3 px-3.5 font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                            +{formatCFA(p.amount)}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-zinc-800 dark:text-zinc-200">
                            {p.saleId ? `#${p.saleId.split('-').pop()?.toUpperCase()}` : "Acompte Général"}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Enregistré
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Partial Payment Modal instance */}
      {selectedInvoiceForPayment && (
        <PartialPaymentModal
          order={selectedInvoiceForPayment}
          buyerName={buyer.name}
          isOpen={true}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onSubmitPayment={(clientId, amount, orderId, method) => {
            onSubmitPayment(clientId, amount, orderId, method);
            setSelectedInvoiceForPayment(null);
          }}
        />
      )}
    </div>
  );
}
