import React, { useState, useMemo } from "react";
import { 
  Search, Scale, Building2, ShoppingCart, MessageSquare, Truck, 
  CheckCircle, AlertCircle, X, ArrowUpDown, Tag, ShieldCheck, Zap,
  Filter, Award, MapPin, ChevronRight, UserCheck, Plus
} from "lucide-react";
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

export function B2BProductComparator({
  products,
  users,
  connections = [],
  currentUser,
  onClose,
  onSelectProductToOrder,
  onContactSupplier,
  onRequestConnection
}: B2BProductComparatorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedProductNames, setSelectedProductNames] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "stock_desc">("price_asc");

  // Extract unique product categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Extract unique normalized product base names to allow multi-supplier comparison
  const productGroupNames = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const cleanName = p.name.trim();
      map.set(cleanName, (map.get(cleanName) || 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([_, count]) => count >= 1)
      .map(([name]) => name);
  }, [products]);

  // Default selection if empty: preselect first 2 multi-supplier product names or top products
  useMemo(() => {
    if (selectedProductNames.length === 0 && productGroupNames.length > 0) {
      // Find a product name that appears in multiple suppliers if possible
      const multi = productGroupNames.find((name) => {
        const matching = products.filter((p) => p.name.trim().toLowerCase() === name.toLowerCase());
        return matching.length > 1;
      });
      if (multi) {
        setSelectedProductNames([multi]);
      } else {
        setSelectedProductNames([productGroupNames[0]]);
      }
    }
  }, [productGroupNames, products]);

  // Filter products matching search and selected category/group
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        searchTerm === "" ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat = selectedCategory === "ALL" || p.category === selectedCategory;

      const matchesGroup =
        selectedProductNames.length === 0 ||
        selectedProductNames.some((gn) => p.name.trim().toLowerCase().includes(gn.toLowerCase()));

      return matchesSearch && matchesCat && matchesGroup;
    });
  }, [products, searchTerm, selectedCategory, selectedProductNames]);

  // Group filtered products by seller/supplier
  const comparisonItems = useMemo(() => {
    let items = filteredProducts.map((p) => {
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

      // Price points
      const wholesalePrice = p.prixGros ?? p.prixDetail ?? 0;
      const semiWholesalePrice = p.prixGros ? Math.round(p.prixGros * 1.05) : (p.prixDetail ?? 0);
      const detailPrice = p.prixDetail ?? wholesalePrice;

      return {
        product: p,
        supplier,
        isConnected,
        wholesalePrice,
        semiWholesalePrice,
        detailPrice,
        stock: (p as any).stock ?? 50,
        minOrderQty: p.quantiteMinimum ?? 1,
        unit: p.unit || "unité"
      };
    });

    // Sort items
    items.sort((a, b) => {
      if (sortBy === "price_asc") return a.wholesalePrice - b.wholesalePrice;
      if (sortBy === "price_desc") return b.wholesalePrice - a.wholesalePrice;
      if (sortBy === "stock_desc") return b.stock - a.stock;
      return 0;
    });

    return items;
  }, [filteredProducts, users, connections, currentUser.id, sortBy]);

  // Identify best price in the current comparison view
  const minWholesalePrice = useMemo(() => {
    if (comparisonItems.length === 0) return 0;
    return Math.min(...comparisonItems.map((i) => i.wholesalePrice));
  }, [comparisonItems]);

  const toggleProductNameSelect = (name: string) => {
    if (selectedProductNames.includes(name)) {
      if (selectedProductNames.length > 1) {
        setSelectedProductNames(selectedProductNames.filter((n) => n !== name));
      }
    } else {
      setSelectedProductNames([...selectedProductNames, name]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-[fadeIn_0.2s_ease]">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-emerald-900/10 via-zinc-900/5 to-amber-900/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Sourcing B2B Multi-Fournisseurs
                </span>
                <span className="text-xs text-zinc-500 font-medium">
                  {comparisonItems.length} offre(s) comparée(s)
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
                Comparateur de Prix & Stocks B2B
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Selection Bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Rechercher un produit, une marque, un code-barres..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-2 px-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Toutes les Catégories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Sort Order */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-zinc-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full py-2 px-3 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="price_asc">Prix de Gros le plus Bas</option>
                <option value="price_desc">Prix de Gros le plus Élevé</option>
                <option value="stock_desc">Disponibilité en Stock</option>
              </select>
            </div>
          </div>

          {/* Quick Product Name Chips for Easy Grouping */}
          {productGroupNames.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
              <span className="text-[10px] font-bold text-zinc-400 uppercase shrink-0">
                Produits à comparer:
              </span>
              {productGroupNames.slice(0, 8).map((name) => {
                const isSelected = selectedProductNames.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleProductNameSelect(name)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750"
                    }`}
                  >
                    <span>{name}</span>
                    {isSelected && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Comparison Content Table / Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {comparisonItems.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <AlertCircle className="w-12 h-12 text-zinc-400 mx-auto animate-bounce" />
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                Aucun produit correspondant aux critères
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Ajustez vos filtres de recherche ou sélectionnez d'autres noms de produits dans la barre ci-dessus pour comparer les tarifs fournisseurs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparisonItems.map((item) => {
                const isBestPrice = item.wholesalePrice === minWholesalePrice && comparisonItems.length > 1;
                const supplierName = item.supplier?.companyName || item.supplier?.name || "Fournisseur Inconnu";
                const isStockLow = item.stock <= (item.product.minStockThreshold || 5);
                const isOutOfStock = item.stock <= 0;

                return (
                  <div
                    key={item.product.id}
                    className={`bg-white dark:bg-zinc-950 border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md relative overflow-hidden ${
                      isBestPrice
                        ? "border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {/* Best Price Badge */}
                    {isBestPrice && (
                      <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-sm">
                        <Award className="w-3 h-3" /> Meilleur Prix
                      </div>
                    )}

                    <div>
                      {/* Supplier Info Header */}
                      <div className="flex items-start gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400 text-sm shrink-0 border border-zinc-200 dark:border-zinc-700">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="pr-12">
                          <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                            {supplierName}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                              {item.supplier?.role || "Grossiste"}
                            </span>
                            {item.supplier?.city && (
                              <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" /> {item.supplier.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Product Name & Details */}
                      <div className="space-y-2 mb-4">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white line-clamp-1">
                          {item.product.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                            {item.product.category || "Général"}
                          </span>
                          {item.product.packaging && (
                            <span className="text-[10px] text-zinc-500">
                              Conditionnement: {item.product.packaging}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price Grid Breakdown */}
                      <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-150 dark:border-zinc-800 space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            Prix de Gros :
                          </span>
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatCFA(item.wholesalePrice)}
                          </span>
                        </div>
                        {item.semiWholesalePrice && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">Demi-Gros :</span>
                            <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                              {formatCFA(item.semiWholesalePrice)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500">Prix Détail Indicatif :</span>
                          <span className="font-semibold text-zinc-600 dark:text-zinc-400 font-mono">
                            {formatCFA(item.detailPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Stock Level & Minimum Order Quantity */}
                      <div className="space-y-1.5 text-xs mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 font-medium">Disponibilité :</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isOutOfStock
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : isStockLow
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {isOutOfStock
                              ? "Rupture de Stock"
                              : `${item.stock} ${item.unit}s disponibles`}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-zinc-500">
                          <span>Quantité Min. Commande (MOQ) :</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {item.minOrderQty} {item.unit}(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                      <button
                        onClick={() => onSelectProductToOrder && onSelectProductToOrder(item.product)}
                        disabled={isOutOfStock}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                          isOutOfStock
                            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                        }`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Commander au Fournisseur</span>
                      </button>

                      <div className="flex gap-2">
                        {item.supplier && (
                          <button
                            onClick={() => onContactSupplier && onContactSupplier(item.supplier!.id)}
                            className="w-full py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                            <span>Discuter / Négocier</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Summary */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span>
              Les prix de gros affichés incluent les remises tarifaires négociées sur la plateforme.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
          >
            Fermer le Comparateur
          </button>
        </div>
      </div>
    </div>
  );
}
