import React, { useState, useMemo } from "react";
import { 
  Search, Scale, Building2, ShoppingCart, MessageSquare, Truck, 
  CheckCircle, AlertCircle, X, ArrowUpDown, Tag, ShieldCheck, Zap,
  Filter, Award, MapPin, ChevronRight, UserCheck, Plus, Download,
  LayoutGrid, ListFilter, Calculator, Sparkles, Pin, Check, ArrowRight,
  TrendingUp, Layers, RefreshCw, DollarSign
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Product, UserProfile, UserRole, Connection, isConnectionActive } from "../types";
import { formatCFA } from "../data";

interface B2BProductComparatorProps {
  products: Product[];
  users: UserProfile[];
  connections?: Connection[];
  currentUser: UserProfile;
  onClose: () => void;
  onSelectProductToOrder?: (product: Product) => void;
  onContactSupplier?: (supplierId: string) => void;
  onRequestConnection?: (targetUserId: string) => void;
}

interface ComparisonOffer {
  product: Product;
  supplier?: UserProfile;
  supplierName: string;
  supplierRole: string;
  city: string;
  isConnected: boolean;
  wholesalePrice: number;
  semiWholesalePrice: number;
  detailPrice: number;
  marginAmount: number;
  marginPercent: number;
  stock: number;
  minOrderQty: number;
  unit: string;
  isBestPrice: boolean;
  isOutOfStock: boolean;
  isLowStock: boolean;
  savingsVsMax: number;
  savingsVsMaxPercent: number;
  competingOffersCount: number;
}

export function B2BProductComparator({
  products = [],
  users = [],
  connections = [],
  currentUser,
  onClose,
  onSelectProductToOrder,
  onContactSupplier,
  onRequestConnection
}: B2BProductComparatorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedSupplierId, setSelectedSupplierId] = useState("ALL");
  const [quickFilter, setQuickFilter] = useState<"all" | "multi_supplier" | "best_price" | "in_stock" | "connected">("all");
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "margin_desc" | "stock_desc" | "moq_asc">("price_asc");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [pinnedProductIds, setPinnedProductIds] = useState<string[]>([]);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorVolume, setSimulatorVolume] = useState<number>(50);

  // 1. Extract unique categories and suppliers
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  const suppliersList = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      const supId = p.creatorId || (p as any).ownerId;
      if (supId) {
        const u = users.find((usr) => usr.id === supId);
        if (u) {
          map.set(supId, u.companyName || u.name || "Fournisseur");
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products, users]);

  // 2. Compute count of competing offers per normalized product name
  const productNameStats = useMemo(() => {
    const countMap = new Map<string, number>();
    const minPriceMap = new Map<string, number>();
    const maxPriceMap = new Map<string, number>();

    products.forEach((p) => {
      const normName = p.name.trim().toLowerCase();
      countMap.set(normName, (countMap.get(normName) || 0) + 1);

      const price = p.prixGros ?? p.prixDetail ?? 0;
      if (price > 0) {
        const currentMin = minPriceMap.get(normName) ?? Infinity;
        if (price < currentMin) minPriceMap.set(normName, price);

        const currentMax = maxPriceMap.get(normName) ?? 0;
        if (price > currentMax) maxPriceMap.set(normName, price);
      }
    });

    return { countMap, minPriceMap, maxPriceMap };
  }, [products]);

  // 3. Build enriched list of offers
  const allOffers = useMemo<ComparisonOffer[]>(() => {
    return products.map((p) => {
      const supplierId = p.creatorId || (p as any).ownerId;
      const supplier = users.find((u) => u.id === supplierId);
      const isConnected = supplier && connections
        ? connections.some(
            (c) =>
              ((c.senderId === currentUser.id && c.receiverId === supplier.id) ||
                (c.senderId === supplier.id && c.receiverId === currentUser.id)) &&
              isConnectionActive(c)
          )
        : false;

      const normName = p.name.trim().toLowerCase();
      const wholesalePrice = p.prixGros ?? p.prixDetail ?? 0;
      const semiWholesalePrice = p.prixGros ? Math.round(p.prixGros * 1.05) : (p.prixDetail ?? 0);
      const detailPrice = p.prixDetail ?? wholesalePrice;

      const marginAmount = Math.max(0, detailPrice - wholesalePrice);
      const marginPercent = wholesalePrice > 0 ? Math.round((marginAmount / wholesalePrice) * 100) : 0;

      const minPriceForProduct = productNameStats.minPriceMap.get(normName) ?? wholesalePrice;
      const maxPriceForProduct = productNameStats.maxPriceMap.get(normName) ?? wholesalePrice;
      const competingCount = productNameStats.countMap.get(normName) ?? 1;

      const isBestPrice = wholesalePrice === minPriceForProduct && competingCount > 1;
      const savingsVsMax = Math.max(0, maxPriceForProduct - wholesalePrice);
      const savingsVsMaxPercent = maxPriceForProduct > 0 ? Math.round((savingsVsMax / maxPriceForProduct) * 100) : 0;

      const stock = (p as any).stock ?? 50;
      const minStockThreshold = p.lowStockThreshold ?? (p as any).minStockThreshold ?? 5;
      const isOutOfStock = stock <= 0;
      const isLowStock = stock > 0 && stock <= minStockThreshold;

      return {
        product: p,
        supplier,
        supplierName: supplier?.companyName || supplier?.name || "Grossiste Indépendant",
        supplierRole: supplier?.role === UserRole.MANUFACTURER ? "Fabricant / Usine" : supplier?.role === UserRole.SEMI_WHOLESALER ? "Demi-Grossiste" : "Grossiste B2B",
        city: supplier?.region || supplier?.address || supplier?.country || "National",
        isConnected,
        wholesalePrice,
        semiWholesalePrice,
        detailPrice,
        marginAmount,
        marginPercent,
        stock,
        minOrderQty: p.quantiteMinimum ?? 1,
        unit: p.unit || "unité",
        isBestPrice,
        isOutOfStock,
        isLowStock,
        savingsVsMax,
        savingsVsMaxPercent,
        competingOffersCount: competingCount
      };
    });
  }, [products, users, connections, currentUser.id, productNameStats]);

  // 4. Filter and sort offers
  const filteredOffers = useMemo(() => {
    return allOffers
      .filter((offer) => {
        // Search term
        if (searchTerm.trim() !== "") {
          const q = searchTerm.toLowerCase();
          const matchesName = offer.product.name.toLowerCase().includes(q);
          const matchesCategory = offer.product.category?.toLowerCase().includes(q);
          const matchesSupplier = offer.supplierName.toLowerCase().includes(q);
          const matchesCity = offer.city.toLowerCase().includes(q);
          const matchesBarcode = offer.product.barcode?.toLowerCase().includes(q);
          if (!matchesName && !matchesCategory && !matchesSupplier && !matchesCity && !matchesBarcode) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== "ALL" && offer.product.category !== selectedCategory) {
          return false;
        }

        // Supplier filter
        if (selectedSupplierId !== "ALL") {
          const supId = offer.product.creatorId || (offer.product as any).ownerId;
          if (supId !== selectedSupplierId) return false;
        }

        // Quick filter pills
        if (quickFilter === "multi_supplier" && offer.competingOffersCount < 2) return false;
        if (quickFilter === "best_price" && !offer.isBestPrice) return false;
        if (quickFilter === "in_stock" && offer.isOutOfStock) return false;
        if (quickFilter === "connected" && !offer.isConnected) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.wholesalePrice - b.wholesalePrice;
        if (sortBy === "price_desc") return b.wholesalePrice - a.wholesalePrice;
        if (sortBy === "margin_desc") return b.marginPercent - a.marginPercent;
        if (sortBy === "stock_desc") return b.stock - a.stock;
        if (sortBy === "moq_asc") return a.minOrderQty - b.minOrderQty;
        return 0;
      });
  }, [allOffers, searchTerm, selectedCategory, selectedSupplierId, quickFilter, sortBy]);

  // Count multi-supplier items for the badge
  const multiSupplierOffersCount = useMemo(() => {
    return allOffers.filter((o) => o.competingOffersCount >= 2).length;
  }, [allOffers]);

  // Pinned items for direct side-by-side comparison
  const pinnedOffers = useMemo(() => {
    return allOffers.filter((o) => pinnedProductIds.includes(o.product.id));
  }, [allOffers, pinnedProductIds]);

  const togglePin = (productId: string) => {
    if (pinnedProductIds.includes(productId)) {
      setPinnedProductIds(pinnedProductIds.filter((id) => id !== productId));
    } else {
      if (pinnedProductIds.length >= 4) {
        setPinnedProductIds([...pinnedProductIds.slice(1), productId]);
      } else {
        setPinnedProductIds([...pinnedProductIds, productId]);
      }
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text("WAKAT ERP - COMPARATEUR DE PRIX & STOCKS B2B", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date d'export : ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 14, 28);
      doc.text(`Utilisateur : ${currentUser.companyName || currentUser.name} (${currentUser.role})`, 14, 34);

      doc.setDrawColor(220, 220, 220);
      doc.line(14, 38, 196, 38);

      let y = 46;
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text("Sélection d'Offres Comparées :", 14, y);
      y += 8;

      const itemsToExport = pinnedOffers.length > 0 ? pinnedOffers : filteredOffers.slice(0, 15);

      itemsToExport.forEach((item, index) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`${index + 1}. ${item.product.name}`, 14, y);

        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`Fournisseur: ${item.supplierName} (${item.city}) | Stock: ${item.stock} ${item.unit}s | MOQ: ${item.minOrderQty}`, 14, y + 5);

        doc.setFontSize(9);
        doc.setTextColor(16, 185, 129);
        doc.text(`Prix Gros: ${formatCFA(item.wholesalePrice)} | Détail Indicatif: ${formatCFA(item.detailPrice)} | Marge: +${item.marginPercent}%`, 14, y + 10);

        if (item.savingsVsMax > 0) {
          doc.setTextColor(217, 119, 6);
          doc.text(`Économie vs prix max: -${formatCFA(item.savingsVsMax)} (-${item.savingsVsMaxPercent}%)`, 14, y + 15);
          y += 20;
        } else {
          y += 16;
        }
      });

      doc.save(`Wakat_Comparatif_B2B_${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF Export error:", err);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("ALL");
    setSelectedSupplierId("ALL");
    setQuickFilter("all");
    setSortBy("price_asc");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* TOP MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-zinc-500/5 to-teal-500/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Sourcing & Tarifs B2B
                </span>
                <span className="text-xs text-zinc-500 font-medium">
                  {filteredOffers.length} offre(s) répertoriée(s)
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                Comparateur Multi-Fournisseurs
              </h2>
            </div>
          </div>

          {/* Top Actions: View Switcher, Simulator, Export & Close */}
          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title="Vue Cartes"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cartes</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === "table"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title="Vue Tableau Matriciel"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tableau</span>
              </button>
            </div>

            {/* Profit Simulator Toggle */}
            <button
              type="button"
              onClick={() => setShowSimulator(!showSimulator)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                showSimulator
                  ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
              }`}
              title="Simulateur de Rentabilité d'Achat"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Simulateur d'Achat</span>
            </button>

            {/* PDF Export */}
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
              title="Exporter le comparatif en PDF"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Export PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer border border-zinc-200 dark:border-zinc-700 ml-1"
              title="Fermer le comparateur"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SEARCH, FILTERS & SORT BAR */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Produit, fournisseur, ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-2 px-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Toutes les Catégories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Supplier Select */}
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="py-2 px-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Tous les Fournisseurs ({suppliersList.length})</option>
              {suppliersList.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>

            {/* Sort Order */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full py-2 px-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="price_asc">Prix de Gros le plus Bas (Top Éco)</option>
                <option value="price_desc">Prix de Gros le plus Élevé</option>
                <option value="margin_desc">Marge Revente la plus Élevée (%)</option>
                <option value="stock_desc">Disponibilité Stock Décroissant</option>
                <option value="moq_asc">Quantité Minimum Commande (MOQ Bas)</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin text-xs">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1 shrink-0">
                Filtres Rapides:
              </span>

              <button
                type="button"
                onClick={() => setQuickFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                  quickFilter === "all"
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Toutes ({allOffers.length})
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("multi_supplier")}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                  quickFilter === "multi_supplier"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multi-Grossistes ({multiSupplierOffersCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("best_price")}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                  quickFilter === "best_price"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Meilleurs Prix</span>
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("in_stock")}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                  quickFilter === "in_stock"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>En Stock Immédiat</span>
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("connected")}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                  quickFilter === "connected"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Mes Partenaires</span>
              </button>
            </div>

            {(searchTerm || selectedCategory !== "ALL" || selectedSupplierId !== "ALL" || quickFilter !== "all") && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-600 underline flex items-center gap-1 shrink-0 ml-2"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>

        {/* PURCHASING & PROFIT SIMULATOR ACCORDION */}
        {showSimulator && (
          <div className="p-4 border-b border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/30 shrink-0 animate-in slide-in-from-top-2">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Simulateur de Budget & Gain Réalisé
                  </h4>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    Ajustez le volume d'approvisionnement pour visualiser immédiatement le coût total et le gain chez chaque grossiste.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 shadow-2xs">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    Volume d'achat souhaité :
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={simulatorVolume}
                    onChange={(e) => setSimulatorVolume(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-2 py-0.5 text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-xs text-zinc-400 font-medium">unités/cartons</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSimulator(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
                  title="Fermer le simulateur"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PINNED COMPARISON DRAWER / FLOATING BAR (If 2+ items are pinned) */}
        {pinnedOffers.length > 0 && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border-b border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                <span>{pinnedOffers.length} offre(s) épinglée(s) pour face-à-face :</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {pinnedOffers.map((po) => (
                  <span
                    key={po.product.id}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white dark:bg-zinc-900 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                  >
                    <span className="truncate max-w-[130px]">{po.product.name} ({po.supplierName})</span>
                    <button
                      type="button"
                      onClick={() => togglePin(po.product.id)}
                      className="hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPinnedProductIds([])}
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-1"
              >
                Vider la sélection
              </button>
            </div>
          </div>
        )}

        {/* MAIN BODY / OFFERS DISPLAY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredOffers.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <AlertCircle className="w-12 h-12 text-zinc-400 mx-auto" />
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                Aucune offre B2B correspondante
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Modifiez vos termes de recherche ou réinitialisez les filtres pour découvrir les tarifs d'autres fournisseurs.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                Afficher toutes les offres
              </button>
            </div>
          ) : viewMode === "cards" ? (
            /* CARDS VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOffers.map((item) => {
                const isPinned = pinnedProductIds.includes(item.product.id);
                const simTotalCost = item.wholesalePrice * simulatorVolume;
                const simTotalRevenue = item.detailPrice * simulatorVolume;
                const simTotalProfit = Math.max(0, simTotalRevenue - simTotalCost);

                return (
                  <div
                    key={item.product.id}
                    className={`bg-white dark:bg-zinc-950 border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-md relative overflow-hidden ${
                      isPinned
                        ? "border-indigo-500 ring-2 ring-indigo-500/25"
                        : item.isBestPrice
                        ? "border-emerald-500/80 ring-1 ring-emerald-500/20"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-1 mb-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {item.isBestPrice && (
                          <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-2xs">
                            <Award className="w-2.5 h-2.5" /> Meilleur Prix
                          </span>
                        )}
                        {item.isConnected && (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            <UserCheck className="w-2.5 h-2.5" /> Partenaire
                          </span>
                        )}
                        {item.competingOffersCount >= 2 && (
                          <span className="inline-flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            {item.competingOffersCount} offres dispo
                          </span>
                        )}
                      </div>

                      {/* Pin Button */}
                      <button
                        type="button"
                        onClick={() => togglePin(item.product.id)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isPinned
                            ? "bg-indigo-600 text-white"
                            : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                        title={isPinned ? "Désépingler" : "Épingler pour comparer"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-white" : ""}`} />
                      </button>
                    </div>

                    <div>
                      {/* Supplier Row */}
                      <div className="flex items-start gap-2.5 pb-2.5 mb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
                        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 border border-zinc-200 dark:border-zinc-700">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white truncate">
                            {item.supplierName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                            <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                              {item.supplierRole}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin className="w-2.5 h-2.5" /> {item.city}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Product Name & Category */}
                      <div className="mb-3">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white line-clamp-1">
                          {item.product.name}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-medium text-zinc-600 dark:text-zinc-400">
                            {item.product.category || "Général"}
                          </span>
                          {item.product.packaging && (
                            <span className="truncate">Emb: {item.product.packaging}</span>
                          )}
                        </div>
                      </div>

                      {/* Pricing Block */}
                      <div className="bg-zinc-50 dark:bg-zinc-900/70 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-2 mb-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            Prix de Gros B2B :
                          </span>
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatCFA(item.wholesalePrice)}
                          </span>
                        </div>

                        {item.semiWholesalePrice > 0 && item.semiWholesalePrice !== item.wholesalePrice && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500 text-[11px]">Demi-Gros :</span>
                            <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                              {formatCFA(item.semiWholesalePrice)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 text-[11px]">Prix Détail Conseillé :</span>
                          <span className="font-medium text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                            {formatCFA(item.detailPrice)}
                          </span>
                        </div>

                        {/* Estimated Margin & Savings */}
                        <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Marge Est.: +{item.marginPercent}%
                          </span>
                          {item.savingsVsMax > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              Éco: -{formatCFA(item.savingsVsMax)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock & MOQ Info */}
                      <div className="space-y-1 text-xs mb-3 text-zinc-600 dark:text-zinc-400">
                        <div className="flex justify-between items-center text-[11px]">
                          <span>Disponibilité :</span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              item.isOutOfStock
                                ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                : item.isLowStock
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            }`}
                          >
                            {item.isOutOfStock ? "Rupture" : `${item.stock} ${item.unit}s`}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span>Commande Min. (MOQ) :</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {item.minOrderQty} {item.unit}(s)
                          </span>
                        </div>
                      </div>

                      {/* Simulator preview if open */}
                      {showSimulator && (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 mb-3 text-[11px] space-y-1">
                          <div className="flex justify-between text-amber-900 dark:text-amber-200 font-bold">
                            <span>Pour {simulatorVolume} {item.unit}s :</span>
                            <span>{formatCFA(simTotalCost)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                            <span>Bénéfice Prévisionnel :</span>
                            <span>+{formatCFA(simTotalProfit)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                      <button
                        type="button"
                        onClick={() => onSelectProductToOrder && onSelectProductToOrder(item.product)}
                        disabled={item.isOutOfStock}
                        className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs ${
                          item.isOutOfStock
                            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Commander au Fournisseur</span>
                      </button>

                      <div className="flex gap-2">
                        {item.supplier && (
                          <button
                            type="button"
                            onClick={() => onContactSupplier && onContactSupplier(item.supplier!.id)}
                            className="w-full py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                            <span>Discuter / Négocier</span>
                          </button>
                        )}
                        {!item.isConnected && item.supplier && onRequestConnection && (
                          <button
                            type="button"
                            onClick={() => onRequestConnection(item.supplier!.id)}
                            className="py-1.5 px-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer shrink-0"
                            title="Demander une connexion partenaire"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW (Tableau Matriciel) */
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Produit</th>
                      <th className="py-3 px-3">Fournisseur & Ville</th>
                      <th className="py-3 px-3">Prix Gros B2B</th>
                      <th className="py-3 px-3">Demi-Gros</th>
                      <th className="py-3 px-3">Détail Conseillé</th>
                      <th className="py-3 px-3">Marge Est.</th>
                      <th className="py-3 px-3">Stock & MOQ</th>
                      {showSimulator && <th className="py-3 px-3 text-amber-700 dark:text-amber-400">Total ({simulatorVolume}u)</th>}
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {filteredOffers.map((item) => {
                      const isPinned = pinnedProductIds.includes(item.product.id);
                      const simTotalCost = item.wholesalePrice * simulatorVolume;

                      return (
                        <tr
                          key={item.product.id}
                          className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60 transition ${
                            isPinned ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                          }`}
                        >
                          {/* Product */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span>{item.product.name}</span>
                              {item.isBestPrice && (
                                <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-1.5 py-0.2 rounded">
                                  Top Prix
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {item.product.category || "Général"}
                              {item.product.packaging && ` • ${item.product.packaging}`}
                            </div>
                          </td>

                          {/* Supplier */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-200">
                              {item.supplierName}
                            </div>
                            <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-2.5 h-2.5" /> {item.city}
                              {item.isConnected && (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">• Partenaire</span>
                              )}
                            </div>
                          </td>

                          {/* Wholesale Price */}
                          <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatCFA(item.wholesalePrice)}
                          </td>

                          {/* Semi Wholesale */}
                          <td className="py-3 px-3 font-mono text-zinc-600 dark:text-zinc-300">
                            {item.semiWholesalePrice ? formatCFA(item.semiWholesalePrice) : "—"}
                          </td>

                          {/* Retail Price */}
                          <td className="py-3 px-3 font-mono text-zinc-500">
                            {formatCFA(item.detailPrice)}
                          </td>

                          {/* Estimated Margin */}
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800">
                              +{item.marginPercent}%
                            </span>
                          </td>

                          {/* Stock & MOQ */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {item.isOutOfStock ? (
                                <span className="text-rose-500 font-bold">Rupture</span>
                              ) : (
                                `${item.stock} ${item.unit}s`
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              MOQ: {item.minOrderQty} {item.unit}(s)
                            </div>
                          </td>

                          {/* Simulator Cost if open */}
                          {showSimulator && (
                            <td className="py-3 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                              {formatCFA(simTotalCost)}
                            </td>
                          )}

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => togglePin(item.product.id)}
                                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                                  isPinned
                                    ? "bg-indigo-600 text-white"
                                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }`}
                                title={isPinned ? "Désépingler" : "Épingler pour comparer"}
                              >
                                <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-white" : ""}`} />
                              </button>

                              {item.supplier && (
                                <button
                                  type="button"
                                  onClick={() => onContactSupplier && onContactSupplier(item.supplier!.id)}
                                  className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                                  title="Discuter / Négocier"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onSelectProductToOrder && onSelectProductToOrder(item.product)}
                                disabled={item.isOutOfStock}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                                  item.isOutOfStock
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                                }`}
                              >
                                <ShoppingCart className="w-3 h-3" />
                                <span>Commander</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Les prix de gros sont affichés en temps réel selon les barèmes configurés par les grossistes partenaires.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-bold text-xs cursor-pointer transition border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exporter en PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-100 transition shadow-xs"
            >
              Fermer le Comparateur
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
