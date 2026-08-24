import React, { useState, useMemo, useEffect } from "react";
import {
  Layers, Package, Folder, Search, Filter, ArrowUpDown, ChevronDown, ChevronRight,
  TrendingUp, Trash2, Edit3, Plus, Download, AlertTriangle, CheckCircle2,
  LayoutGrid, List, SlidersHorizontal, Sparkles, Tag, Boxes, ShieldAlert
} from "lucide-react";
import { Product, InventoryItem, UserRole } from "../types";
import { formatCFA } from "../data";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { PriceRangeSlider } from "./PriceRangeSlider";

interface StockCategoryOrganizerProps {
  inventory: InventoryItem[];
  products: Product[];
  currentUserId: string;
  onUpdateInventory: (
    itemId: string,
    stock: number,
    price: number,
    prixGros?: number,
    prixDetail?: number,
    quantiteMinimum?: number,
    productId?: string
  ) => void;
  onDeleteInventoryItem: (itemId: string, productId?: string, skipConfirm?: boolean) => void;
  onEditProduct?: (product: Product, inventoryItem: InventoryItem) => void;
  onOpenAddModal?: () => void;
  onExportCSV?: () => void;
  title?: string;
  role?: UserRole;
}

// Category helper: get icon and style theme per category
export function getCategoryStyle(categoryName: string) {
  const norm = (categoryName || "Divers").toLowerCase().trim();
  if (norm.includes("aliment") || norm.includes("nourriture") || norm.includes("céréale") || norm.includes("riz") || norm.includes("sucre")) {
    return {
      icon: "🌾",
      color: "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
      accent: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
    };
  }
  if (norm.includes("boisson") || norm.includes("eau") || norm.includes("jus") || norm.includes("soda")) {
    return {
      icon: "🥤",
      color: "bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
      accent: "text-blue-600 dark:text-blue-400",
      badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
    };
  }
  if (norm.includes("électro") || norm.includes("informatique") || norm.includes("téléphone") || norm.includes("tech")) {
    return {
      icon: "⚡",
      color: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
      accent: "text-indigo-600 dark:text-indigo-400",
      badge: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300"
    };
  }
  if (norm.includes("quincaillerie") || norm.includes("outil") || norm.includes("bricolage")) {
    return {
      icon: "🔧",
      color: "bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800/60",
      accent: "text-orange-600 dark:text-orange-400",
      badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300"
    };
  }
  if (norm.includes("cosmétique") || norm.includes("beauté") || norm.includes("parfum")) {
    return {
      icon: "✨",
      color: "bg-pink-50 dark:bg-pink-950/30 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-800/60",
      accent: "text-pink-600 dark:text-pink-400",
      badge: "bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300"
    };
  }
  if (norm.includes("hygiène") || norm.includes("entretien") || norm.includes("savon") || norm.includes("nettoy")) {
    return {
      icon: "🧼",
      color: "bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/60",
      accent: "text-teal-600 dark:text-teal-400",
      badge: "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300"
    };
  }
  if (norm.includes("vêtement") || norm.includes("mode") || norm.includes("textile") || norm.includes("chaussure")) {
    return {
      icon: "👗",
      color: "bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
      accent: "text-purple-600 dark:text-purple-400",
      badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300"
    };
  }
  if (norm.includes("santé") || norm.includes("pharma") || norm.includes("médicament")) {
    return {
      icon: "💊",
      color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
      accent: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
    };
  }
  if (norm.includes("matériau") || norm.includes("construction") || norm.includes("ciment") || norm.includes("fer")) {
    return {
      icon: "🧱",
      color: "bg-stone-50 dark:bg-stone-950/30 text-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-800/60",
      accent: "text-stone-600 dark:text-stone-400",
      badge: "bg-stone-100 dark:bg-stone-900/40 text-stone-800 dark:text-stone-300"
    };
  }
  if (norm.includes("pièce") || norm.includes("rechange") || norm.includes("auto") || norm.includes("moto")) {
    return {
      icon: "⚙️",
      color: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60",
      accent: "text-cyan-600 dark:text-cyan-400",
      badge: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300"
    };
  }
  return {
    icon: "📦",
    color: "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700",
    accent: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
  };
}

export const StockCategoryOrganizer: React.FC<StockCategoryOrganizerProps> = ({
  inventory,
  products,
  currentUserId,
  onUpdateInventory,
  onDeleteInventoryItem,
  onEditProduct,
  onOpenAddModal,
  onExportCSV,
  title = "Gestion & Organisation des Stocks par Catégorie",
  role
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"category_grouped" | "grid" | "table">("category_grouped");
  const [sortOption, setSortOption] = useState<"none" | "stock_asc" | "stock_desc" | "price_asc" | "price_desc" | "name_asc">("none");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [selectedProductForChart, setSelectedProductForChart] = useState<string | null>(null);
  const [showPriceFilterSlider, setShowPriceFilterSlider] = useState(false);

  // Filter items owned by the current user
  const myInventory = useMemo(() => {
    return inventory.filter(
      (i) => i.ownerId === currentUserId || (currentUserId && (i as any).ownerEmail === currentUserId)
    );
  }, [inventory, currentUserId]);

  // Merge inventory with product details
  const enrichedItems = useMemo(() => {
    return myInventory
      .map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const category = prod?.category?.trim() || "Divers";

        const rawPrixGros =
          item.prixGros !== undefined && item.prixGros !== null && item.prixGros > 0
            ? item.prixGros
            : prod?.prixGros !== undefined && prod?.prixGros > 0
            ? prod.prixGros
            : item.price || 0;

        const rawPrixDetail =
          item.prixDetail !== undefined && item.prixDetail !== null && item.prixDetail > 0
            ? item.prixDetail
            : prod?.prixDetail !== undefined && prod?.prixDetail > 0
            ? prod.prixDetail
            : item.price || 0;

        const rawQuantiteMinimum = item.quantiteMinimum || prod?.quantiteMinimum || 1;

        return {
          inventoryItem: item,
          product: prod,
          category,
          name: prod?.name || "Produit sans nom",
          price: item.price || rawPrixGros || rawPrixDetail || 0,
          prixGros: rawPrixGros,
          prixDetail: rawPrixDetail,
          quantiteMinimum: rawQuantiteMinimum,
          stock: item.stock || 0,
          threshold: item.threshold || 10,
          isLowStock: item.stock <= (item.threshold || 10),
          isCritical: item.stock === 0,
        };
      })
      .filter((entry) => !!entry.product);
  }, [myInventory, products]);

  // Price boundaries calculation
  const { minProductPrice, maxProductPrice } = useMemo(() => {
    if (enrichedItems.length === 0) return { minProductPrice: 0, maxProductPrice: 100000 };
    const prices = enrichedItems.map((i) => i.price).filter((p) => p > 0);
    if (prices.length === 0) return { minProductPrice: 0, maxProductPrice: 100000 };
    return {
      minProductPrice: Math.min(...prices),
      maxProductPrice: Math.max(...prices),
    };
  }, [enrichedItems]);

  const [priceFilterRange, setPriceFilterRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 500000,
  });

  // Adjust price filter range when items change if untouched
  useEffect(() => {
    setPriceFilterRange((prev) => ({
      min: Math.min(prev.min, minProductPrice),
      max: Math.max(prev.max, maxProductPrice),
    }));
  }, [minProductPrice, maxProductPrice]);

  // Categories extraction with stats
  const categoryStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; totalUnits: number; totalValuation: number; lowStockCount: number }
    >();

    enrichedItems.forEach((item) => {
      const cat = item.category || "Divers";
      const existing = map.get(cat) || { count: 0, totalUnits: 0, totalValuation: 0, lowStockCount: 0 };
      existing.count += 1;
      existing.totalUnits += item.stock;
      existing.totalValuation += item.stock * item.price;
      if (item.isLowStock) existing.lowStockCount += 1;
      map.set(cat, existing);
    });

    return map;
  }, [enrichedItems]);

  const categoriesList = useMemo(() => {
    const rawKeys: string[] = [];
    categoryStats.forEach((_, key) => {
      rawKeys.push(key);
    });
    return rawKeys.sort((a, b) => a.localeCompare(b));
  }, [categoryStats]);

  // Filtered & Sorted items
  const filteredAndSortedItems = useMemo(() => {
    let list = enrichedItems.filter((item) => {
      const matchesCategory =
        selectedCategoryTab === "ALL" ||
        item.category.toLowerCase() === selectedCategoryTab.toLowerCase();

      if (!matchesCategory) return false;

      // Price range filter
      if (item.price < priceFilterRange.min || item.price > priceFilterRange.max) {
        return false;
      }

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const pName = (item.name || "").toLowerCase();
      const pBrand = (item.product?.brand || "").toLowerCase();
      const pDesc = (item.product?.description || "").toLowerCase();
      const pBarcode = (item.product?.barcode || "").toLowerCase();
      const pCat = (item.category || "").toLowerCase();

      return (
        pName.includes(q) ||
        pBrand.includes(q) ||
        pDesc.includes(q) ||
        pBarcode.includes(q) ||
        pCat.includes(q)
      );
    });

    if (sortOption === "stock_asc") {
      list.sort((a, b) => a.stock - b.stock);
    } else if (sortOption === "stock_desc") {
      list.sort((a, b) => b.stock - a.stock);
    } else if (sortOption === "price_asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortOption === "price_desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortOption === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [enrichedItems, selectedCategoryTab, searchQuery, sortOption, priceFilterRange]);

  // Group items by category for the grouped layout
  const groupedByCategory = useMemo(() => {
    const groups: {
      category: string;
      items: typeof enrichedItems;
      stats: { count: number; totalUnits: number; totalValuation: number; lowStockCount: number };
    }[] = [];

    const groupedMap = new Map<string, typeof enrichedItems>();

    filteredAndSortedItems.forEach((item) => {
      const cat = item.category;
      if (!groupedMap.has(cat)) {
        groupedMap.set(cat, []);
      }
      groupedMap.get(cat)!.push(item);
    });

    groupedMap.forEach((items, category) => {
      const stats = {
        count: items.length,
        totalUnits: items.reduce((sum, i) => sum + i.stock, 0),
        totalValuation: items.reduce((sum, i) => sum + i.stock * i.price, 0),
        lowStockCount: items.filter((i) => i.isLowStock).length,
      };
      groups.push({ category, items, stats });
    });

    // Sort categories alphabetically
    groups.sort((a, b) => a.category.localeCompare(b.category));
    return groups;
  }, [filteredAndSortedItems]);

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const expandAll = () => setCollapsedCategories({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    categoriesList.forEach((c) => (allCollapsed[c] = true));
    setCollapsedCategories(allCollapsed);
  };

  // Overall Totals
  const totalStockUnits = useMemo(() => {
    return enrichedItems.reduce((sum, i) => sum + i.stock, 0);
  }, [enrichedItems]);

  const totalStockValuation = useMemo(() => {
    return enrichedItems.reduce((sum, i) => sum + i.stock * i.price, 0);
  }, [enrichedItems]);

  const totalAlertsCount = useMemo(() => {
    return enrichedItems.filter((i) => i.isLowStock).length;
  }, [enrichedItems]);

  return (
    <div className="space-y-4" id="stock-category-organizer">
      {/* Top Header & Overview bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Boxes className="w-5 h-5" />
              </span>
              <h3 className="text-base font-extrabold text-zinc-950 dark:text-white tracking-tight">
                {title}
              </h3>
              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {categoriesList.length} {categoriesList.length > 1 ? "catégories" : "catégorie"} • {enrichedItems.length} articles
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Disposition claire et structurée de vos marchandises groupées par rayons et familles de produits.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {onExportCSV && (
              <button
                onClick={onExportCSV}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Exporter l'inventaire en fichier CSV"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}

            {onOpenAddModal && (
              <button
                onClick={onOpenAddModal}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                id="add-stock-category-btn"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un produit</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Key Metrics summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Total Références</span>
            <p className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
              {enrichedItems.length} <span className="text-xs font-normal text-zinc-500">articles</span>
            </p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Quantité en Stock</span>
            <p className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5">
              {totalStockUnits.toLocaleString()} <span className="text-xs font-normal text-zinc-500">unités</span>
            </p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-150 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Valeur Marchande</span>
            <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {formatCFA(totalStockValuation)}
            </p>
          </div>
          <div className={`p-3 rounded-xl border ${totalAlertsCount > 0 ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300" : "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"}`}>
            <span className="text-[10px] uppercase font-bold opacity-80">Alertes Stock</span>
            <p className="text-base font-extrabold mt-0.5 flex items-center gap-1.5">
              {totalAlertsCount > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  {totalAlertsCount} à réapprovisionner
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Stock optimal
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xs space-y-3">
        {/* Search, Sort, and Layout Switcher */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une marchandise (nom, marque, code-barres, catégorie)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
            {/* Price Slider Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPriceFilterSlider(!showPriceFilterSlider)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                showPriceFilterSlider || priceFilterRange.min > minProductPrice || priceFilterRange.max < maxProductPrice
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
              }`}
              title="Filtrer par tranche de prix"
              id="toggle-price-range-slider"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Prix {priceFilterRange.min > minProductPrice || priceFilterRange.max < maxProductPrice ? `(${formatCFA(priceFilterRange.min)} - ${formatCFA(priceFilterRange.max)})` : ""}</span>
            </button>

            {/* Sort selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                <option value="none">Tri par défaut</option>
                <option value="stock_asc">Stock Croissant (Faible ➔ Fort) ↑</option>
                <option value="stock_desc">Stock Décroissant (Fort ➔ Faible) ↓</option>
                <option value="price_asc">Prix Croissant (Moins cher) ↑</option>
                <option value="price_desc">Prix Décroissant (Plus cher) ↓</option>
                <option value="name_asc">Nom alphabétique (A ➔ Z)</option>
              </select>
            </div>

            {/* Layout switch buttons */}
            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setViewMode("category_grouped")}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  viewMode === "category_grouped"
                    ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
                title="Disposition groupée par catégorie"
              >
                <Folder className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Par Catégorie</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
                title="Disposition en grille continue"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Grille</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
                title="Disposition en tableau condensé"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Tableau</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills / Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setSelectedCategoryTab("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              selectedCategoryTab === "ALL"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            <span>✨ Toutes les catégories</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategoryTab === "ALL" ? "bg-emerald-700 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"}`}>
              {enrichedItems.length}
            </span>
          </button>

          {categoriesList.map((category) => {
            const stats = categoryStats.get(category);
            const style = getCategoryStyle(category);
            const isSelected = selectedCategoryTab.toLowerCase() === category.toLowerCase();

            return (
              <button
                key={category}
                onClick={() => setSelectedCategoryTab(isSelected ? "ALL" : category)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <span>{style.icon}</span>
                <span>{category}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? "bg-emerald-700 text-white"
                      : style.badge
                  }`}
                >
                  {stats?.count || 0}
                </span>
                {stats && stats.lowStockCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" title={`${stats.lowStockCount} article(s) en stock critique`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Price Range Slider Panel (Collapsible or activated) */}
        {showPriceFilterSlider && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 animate-in fade-in-50 duration-150">
            <PriceRangeSlider
              minPrice={minProductPrice}
              maxPrice={maxProductPrice}
              currentMin={priceFilterRange.min}
              currentMax={priceFilterRange.max}
              matchingCount={filteredAndSortedItems.length}
              totalCount={enrichedItems.length}
              onChange={({ min, max }) => setPriceFilterRange({ min, max })}
              onReset={() => setPriceFilterRange({ min: minProductPrice, max: maxProductPrice })}
            />
          </div>
        )}

        {/* Category grouped helper toggle buttons */}
        {viewMode === "category_grouped" && groupedByCategory.length > 1 && (
          <div className="flex justify-between items-center text-[11px] pt-1 text-zinc-500">
            <span>{groupedByCategory.length} rayons / catégories affichés</span>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
              >
                Tout déplier
              </button>
              <span>•</span>
              <button
                onClick={collapseAll}
                className="text-zinc-500 hover:underline font-bold"
              >
                Tout replier
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
            <Package className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              Aucune marchandise trouvée
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {searchQuery
                ? `Aucun article ne correspond à votre recherche "${searchQuery}".`
                : selectedCategoryTab !== "ALL"
                ? `Aucun produit disponible dans la catégorie "${selectedCategoryTab}".`
                : "Vous n'avez pas encore de marchandise enregistrée dans votre inventaire."}
            </p>
          </div>
          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Ajouter un premier produit
            </button>
          )}
        </div>
      ) : viewMode === "category_grouped" ? (
        /* ------------------------------------------------------------- */
        /* MODE 1: DISPOSITION GROUPÉE PAR CATÉGORIE                     */
        /* ------------------------------------------------------------- */
        <div className="space-y-6">
          {groupedByCategory.map((group) => {
            const isCollapsed = !!collapsedCategories[group.category];
            const catStyle = getCategoryStyle(group.category);

            return (
              <div
                key={group.category}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs transition"
              >
                {/* Category Header Banner */}
                <div
                  onClick={() => toggleCategoryCollapse(group.category)}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer border-b transition ${
                    catStyle.color
                  } ${isCollapsed ? "border-transparent" : "border-zinc-200/60 dark:border-zinc-800/60"}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      className="p-1 rounded-lg bg-white/70 dark:bg-zinc-800/70 text-zinc-700 dark:text-zinc-200 shadow-2xs"
                      aria-label="Toggle Category"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-xl">{catStyle.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-zinc-950 dark:text-white uppercase tracking-wider">
                          {group.category}
                        </h4>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-2xs">
                          {group.stats.count} {group.stats.count > 1 ? "articles" : "article"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Rayon {group.category} • {group.stats.totalUnits.toLocaleString()} unités au total
                      </p>
                    </div>
                  </div>

                  {/* Category summary metrics */}
                  <div className="flex items-center gap-3 text-xs self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Valeur rayon</span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">
                        {formatCFA(group.stats.totalValuation)}
                      </span>
                    </div>

                    {group.stats.lowStockCount > 0 && (
                      <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 border border-rose-200 dark:border-rose-900/60">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {group.stats.lowStockCount} alerte(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Items Grid under this Category */}
                {!isCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50/40 dark:bg-zinc-950/20">
                    {group.items.map(({ inventoryItem: item, product: prod, isLowStock, prixGros, prixDetail, quantiteMinimum }) => (
                      <div
                        key={item.id}
                        className={`p-4 bg-white dark:bg-zinc-900 border rounded-xl flex flex-col justify-between shadow-xs transition hover:shadow-md ${
                          isLowStock
                            ? "border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/20"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3 items-center min-w-0">
                            <img
                              loading="lazy"
                              src={prod.image}
                              alt={prod.name}
                              className="w-13 h-13 rounded-xl object-cover border border-zinc-150 dark:border-zinc-800 shrink-0 bg-zinc-100"
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-xs text-zinc-950 dark:text-white truncate">
                                  {prod.name}
                                </p>
                                {prod.brand && (
                                  <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.2 rounded font-medium">
                                    {prod.brand}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-500 font-medium">
                                {prod.unit ? `Unité : ${prod.unit}` : "Unité standard"} • Seuil : {item.threshold} u
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    item.stock === 0
                                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-black animate-pulse"
                                      : isLowStock
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  }`}
                                >
                                  Stock : {item.stock} u
                                </span>
                              </div>

                              {/* Affichage des tarifs Gros B2B + Min Commande + Prix Détail */}
                              <div className="grid grid-cols-2 gap-1.5 pt-1 mt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px]">
                                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                                  <span className="text-[8px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                                    Prix Gros B2B
                                  </span>
                                  <p className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
                                    {formatCFA(prixGros)}
                                  </p>
                                  <span className="text-[8px] text-zinc-500 block">
                                    Min : {quantiteMinimum} u
                                  </span>
                                </div>
                                <div className="bg-amber-50/70 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                                  <span className="text-[8px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                                    Prix Détail
                                  </span>
                                  <p className="font-mono font-bold text-amber-900 dark:text-amber-200">
                                    {formatCFA(prixDetail)}
                                  </p>
                                  <span className="text-[8px] text-zinc-500 block">
                                    Dès 1 unité
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Quick Chart toggle */}
                          <button
                            onClick={() =>
                              setSelectedProductForChart(
                                selectedProductForChart === item.id ? null : item.id
                              )
                            }
                            className={`p-1.5 rounded-lg transition shrink-0 ${
                              selectedProductForChart === item.id
                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900"
                            }`}
                            title="Afficher l'historique des prix"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Inline fast stock and price updates + Action buttons */}
                        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 items-end max-w-full">
                            <div className="flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-zinc-400">
                                Stock
                              </label>
                              <input
                                type="number"
                                defaultValue={item.stock}
                                className="w-14 px-1 py-1 text-[11px] border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val))
                                    onUpdateInventory(
                                      item.id,
                                      val,
                                      item.price,
                                      prixGros,
                                      prixDetail,
                                      quantiteMinimum,
                                      item.productId
                                    );
                                }}
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-emerald-600 dark:text-emerald-400 truncate">
                                Prix Gros
                              </label>
                              <input
                                type="number"
                                defaultValue={prixGros}
                                className="w-16 px-1 py-1 text-[11px] border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-center font-bold bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-mono"
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val))
                                    onUpdateInventory(
                                      item.id,
                                      item.stock,
                                      val,
                                      val,
                                      prixDetail,
                                      quantiteMinimum,
                                      item.productId
                                    );
                                }}
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-zinc-400 truncate">
                                Min B2B
                              </label>
                              <input
                                type="number"
                                defaultValue={quantiteMinimum}
                                className="w-14 px-1 py-1 text-[11px] border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val >= 1)
                                    onUpdateInventory(
                                      item.id,
                                      item.stock,
                                      item.price,
                                      prixGros,
                                      prixDetail,
                                      val,
                                      item.productId
                                    );
                                }}
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[8px] uppercase font-bold text-amber-600 dark:text-amber-400 truncate">
                                Prix Détail
                              </label>
                              <input
                                type="number"
                                defaultValue={prixDetail}
                                className="w-16 px-1 py-1 text-[11px] border border-amber-200 dark:border-amber-800/60 rounded-lg text-center font-bold bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 font-mono"
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val))
                                    onUpdateInventory(
                                      item.id,
                                      item.stock,
                                      item.price,
                                      prixGros,
                                      val,
                                      quantiteMinimum,
                                      item.productId
                                    );
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            {onEditProduct && (
                              <button
                                onClick={() => onEditProduct(prod, item)}
                                className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                                title="Modifier la fiche complète du produit"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Modifier</span>
                              </button>
                            )}

                            <button
                              onClick={() => onDeleteInventoryItem(item.id, item.productId)}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                              title="Retirer ce produit du stock"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Price History Chart expand */}
                        {selectedProductForChart === item.id && (
                          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 animate-fade-in mt-3">
                            <PriceHistoryChart
                              basePrice={item.price}
                              buyingPrice={prod.prixGros}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === "grid" ? (
        /* ------------------------------------------------------------- */
        /* MODE 2: DISPOSITION EN GRILLE CONTINUE AVEC BADGES CATÉGORIE */
        /* ------------------------------------------------------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedItems.map(({ inventoryItem: item, product: prod, category, isLowStock, prixGros, prixDetail, quantiteMinimum }) => {
            const catStyle = getCategoryStyle(category);
            return (
              <div
                key={item.id}
                className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl flex flex-col justify-between shadow-xs transition hover:shadow-md ${
                  isLowStock
                    ? "border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/20"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${catStyle.color}`}
                    >
                      <span>{catStyle.icon}</span>
                      <span className="truncate max-w-[120px]">{category}</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        item.stock === 0
                          ? "bg-rose-100 text-rose-700 font-black animate-pulse"
                          : isLowStock
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      Stock : {item.stock} u
                    </span>
                  </div>

                  <div className="flex gap-3 items-center">
                    <img
                      loading="lazy"
                      src={prod.image}
                      alt={prod.name}
                      className="w-12 h-12 rounded-xl object-cover border border-zinc-150 dark:border-zinc-800 shrink-0 bg-zinc-100"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-zinc-950 dark:text-white truncate">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {prod.unit || "Unité standard"} • {prod.brand || "Marque standard"}
                      </p>
                    </div>
                  </div>

                  {/* Affichage des tarifs Gros B2B + Min commande + Détail */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                      <span className="text-[8px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                        Prix Gros B2B
                      </span>
                      <p className="font-mono font-bold text-emerald-900 dark:text-emerald-200 text-xs mt-0.5">
                        {formatCFA(prixGros)}
                      </p>
                      <span className="text-[8px] text-zinc-500 block mt-0.5">
                        Min : <strong className="text-zinc-700 dark:text-zinc-300">{quantiteMinimum} u</strong>
                      </span>
                    </div>

                    <div className="bg-amber-50/70 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                      <span className="text-[8px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                        Prix Détail
                      </span>
                      <p className="font-mono font-bold text-amber-900 dark:text-amber-200 text-xs mt-0.5">
                        {formatCFA(prixDetail)}
                      </p>
                      <span className="text-[8px] text-zinc-500 block mt-0.5">
                        Dès 1 unité
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="grid grid-cols-4 gap-1 items-end">
                    <div className="flex flex-col">
                      <label className="text-[8px] uppercase font-bold text-zinc-400">Stock</label>
                      <input
                        type="number"
                        defaultValue={item.stock}
                        className="w-12 px-1 py-1 text-[10px] border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        title="Stock"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val))
                            onUpdateInventory(
                              item.id,
                              val,
                              item.price,
                              prixGros,
                              prixDetail,
                              quantiteMinimum,
                              item.productId
                            );
                        }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] uppercase font-bold text-emerald-600 truncate">Gros</label>
                      <input
                        type="number"
                        defaultValue={prixGros}
                        className="w-14 px-1 py-1 text-[10px] border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-center font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-mono"
                        title="Prix Gros B2B"
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val))
                            onUpdateInventory(
                              item.id,
                              item.stock,
                              val,
                              val,
                              prixDetail,
                              quantiteMinimum,
                              item.productId
                            );
                        }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] uppercase font-bold text-zinc-400 truncate">Min</label>
                      <input
                        type="number"
                        defaultValue={quantiteMinimum}
                        className="w-12 px-1 py-1 text-[10px] border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        title="Min commande"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1)
                            onUpdateInventory(
                              item.id,
                              item.stock,
                              item.price,
                              prixGros,
                              prixDetail,
                              val,
                              item.productId
                            );
                        }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] uppercase font-bold text-amber-600 truncate">Détail</label>
                      <input
                        type="number"
                        defaultValue={prixDetail}
                        className="w-14 px-1 py-1 text-[10px] border border-amber-200 dark:border-amber-800/60 rounded-lg text-center font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-mono"
                        title="Prix Détail"
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val))
                            onUpdateInventory(
                              item.id,
                              item.stock,
                              item.price,
                              prixGros,
                              val,
                              quantiteMinimum,
                              item.productId
                            );
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    {onEditProduct && (
                      <button
                        onClick={() => onEditProduct(prod, item)}
                        className="p-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100"
                        title="Modifier"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteInventoryItem(item.id, item.productId)}
                      className="p-1.5 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-100"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* MODE 3: DISPOSITION EN TABLEAU CONDENSÉ                       */
        /* ------------------------------------------------------------- */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-extrabold tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-3 py-3">Marchandise</th>
                  <th className="px-3 py-3">Catégorie</th>
                  <th className="px-3 py-3 text-center">Quantité Stock</th>
                  <th className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400">Prix Gros B2B (CFA)</th>
                  <th className="px-3 py-3 text-center">Min. B2B</th>
                  <th className="px-3 py-3 text-center text-amber-600 dark:text-amber-400">Prix Détail (CFA)</th>
                  <th className="px-3 py-3 text-right">Valeur Stock</th>
                  <th className="px-3 py-3 text-center">État</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredAndSortedItems.map(({ inventoryItem: item, product: prod, category, isLowStock, prixGros, prixDetail, quantiteMinimum }) => {
                  const catStyle = getCategoryStyle(category);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition text-zinc-700 dark:text-zinc-300"
                    >
                      <td className="px-3 py-3 flex items-center gap-2.5">
                        <img
                          loading="lazy"
                          src={prod.image}
                          alt={prod.name}
                          className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0 bg-zinc-100"
                        />
                        <div>
                          <p className="font-bold text-zinc-950 dark:text-white truncate max-w-[160px]">
                            {prod.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            {prod.unit || "Unité"} • {prod.brand || "Marque"}
                          </p>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${catStyle.color}`}
                        >
                          <span>{catStyle.icon}</span>
                          <span>{category}</span>
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.stock}
                          className="w-14 px-1.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val))
                              onUpdateInventory(
                                item.id,
                                val,
                                item.price,
                                prixGros,
                                prixDetail,
                                quantiteMinimum,
                                item.productId
                              );
                          }}
                        />
                      </td>

                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          defaultValue={prixGros}
                          className="w-20 px-1.5 py-1 text-xs border border-emerald-200 dark:border-emerald-800 rounded-lg text-center font-bold bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-mono"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val))
                              onUpdateInventory(
                                item.id,
                                item.stock,
                                val,
                                val,
                                prixDetail,
                                quantiteMinimum,
                                item.productId
                              );
                          }}
                        />
                      </td>

                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          defaultValue={quantiteMinimum}
                          className="w-14 px-1.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg text-center font-bold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 1)
                              onUpdateInventory(
                                item.id,
                                item.stock,
                                item.price,
                                prixGros,
                                prixDetail,
                                val,
                                item.productId
                              );
                          }}
                        />
                      </td>

                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          defaultValue={prixDetail}
                          className="w-20 px-1.5 py-1 text-xs border border-amber-200 dark:border-amber-800 rounded-lg text-center font-bold bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-mono"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val))
                              onUpdateInventory(
                                item.id,
                                item.stock,
                                item.price,
                                prixGros,
                                val,
                                quantiteMinimum,
                                item.productId
                              );
                          }}
                        />
                      </td>

                      <td className="px-3 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {formatCFA(item.stock * (prixGros || item.price))}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            item.stock === 0
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                              : isLowStock
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          }`}
                        >
                          {item.stock === 0 ? "Rupture" : isLowStock ? "Stock Bas" : "OK"}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onEditProduct && (
                            <button
                              onClick={() => onEditProduct(prod, item)}
                              className="p-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-100"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteInventoryItem(item.id, item.productId)}
                            className="p-1.5 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-100"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
  );
};
