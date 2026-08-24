import React, { useState, useMemo } from "react";
import { 
  TrendingUp, AlertTriangle, RefreshCw, Calendar, Package, 
  ShoppingCart, ArrowRight, ShieldAlert, CheckCircle, Sliders, 
  Download, Sparkles, Box, Info, ArrowUpRight
} from "lucide-react";
import { Product, Order, OrderStatus, UserProfile } from "../types";
import { formatCFA } from "../data";

interface StockForecastModuleProps {
  products: Product[];
  orders: Order[];
  currentUser: UserProfile;
  onOpenReorderModal?: (product: Product, suggestedQty: number) => void;
  onOpenComparator?: () => void;
}

export function StockForecastModule({
  products,
  orders,
  currentUser,
  onOpenReorderModal,
  onOpenComparator
}: StockForecastModuleProps) {
  // Configurable parameters
  const [leadTimeDays, setLeadTimeDays] = useState(7); // Lead time in days
  const [targetCoverageDays, setTargetCoverageDays] = useState(30); // Desired coverage in days
  const [filterStatus, setFilterStatus] = useState<"ALL" | "CRITICAL" | "RECOMMENDED" | "HEALTHY" | "OVERSTOCK">("ALL");

  // Filter 30-day sales history for current merchant
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  // Compute 30-day sales quantity per product
  const salesMap = useMemo(() => {
    const map = new Map<string, number>();

    orders.forEach((o) => {
      // Filter orders where currentUser is seller or recipient
      if (o.receiverId === currentUser.id || (o as any).sellerId === currentUser.id) {
        const orderDate = new Date(o.createdAt);
        if (orderDate >= thirtyDaysAgo && o.status !== OrderStatus.CANCELLED) {
          if (o.items && o.items.length > 0) {
            o.items.forEach((item) => {
              const current = map.get(item.productId) || 0;
              map.set(item.productId, current + item.quantity);
            });
          }
        }
      }
    });

    return map;
  }, [orders, currentUser.id, thirtyDaysAgo]);

  // Compute forecast metrics for each product owned or available to the user
  const forecastList = useMemo(() => {
    // Show user's products or catalog products
    const userProducts = products.filter(
      (p) => p.creatorId === currentUser.id || (p as any).ownerId === currentUser.id || products.length <= 20
    );
    const targetProducts = userProducts.length > 0 ? userProducts : products;

    return targetProducts.map((p) => {
      const quantitySold30Days = salesMap.get(p.id) || 0;
      const dailySalesRate = quantitySold30Days / 30; // average daily velocity
      const currentStock = (p as any).stock ?? 25;

      // Days of remaining stock
      const daysRemaining = dailySalesRate > 0 ? Math.round(currentStock / dailySalesRate) : currentStock > 0 ? 999 : 0;

      // Reorder Point (Lead Time + 7 days safety buffer)
      const safetyBufferDays = 7;
      const reorderPoint = Math.ceil(dailySalesRate * (leadTimeDays + safetyBufferDays));

      // Target stock coverage
      const targetStockLevel = Math.ceil(dailySalesRate * targetCoverageDays);

      // Suggested reorder quantity
      const needsReorder = currentStock <= reorderPoint || currentStock <= (p.lowStockThreshold || 5);
      const suggestedReorderQuantity = needsReorder
        ? Math.max(Math.ceil(targetStockLevel - currentStock), Math.ceil(dailySalesRate * 14))
        : 0;

      // Categorization status
      let status: "CRITICAL" | "RECOMMENDED" | "HEALTHY" | "OVERSTOCK" = "HEALTHY";
      if (currentStock <= 0 || daysRemaining < 7) {
        status = "CRITICAL";
      } else if (currentStock <= reorderPoint || daysRemaining <= 14) {
        status = "RECOMMENDED";
      } else if (daysRemaining > 60 && currentStock > 50) {
        status = "OVERSTOCK";
      }

      return {
        product: p,
        quantitySold30Days,
        dailySalesRate,
        currentStock,
        daysRemaining,
        reorderPoint,
        targetStockLevel,
        suggestedReorderQuantity,
        needsReorder,
        status,
        unitPrice: p.prixGros || p.prixDetail
      };
    });
  }, [products, currentUser.id, salesMap, leadTimeDays, targetCoverageDays]);

  // Filtered forecast list according to selected tab
  const filteredForecasts = useMemo(() => {
    if (filterStatus === "ALL") return forecastList;
    return forecastList.filter((f) => f.status === filterStatus);
  }, [forecastList, filterStatus]);

  // Aggregated Summary Statistics
  const stats = useMemo(() => {
    const criticalCount = forecastList.filter((f) => f.status === "CRITICAL").length;
    const recommendedCount = forecastList.filter((f) => f.status === "RECOMMENDED").length;
    const healthyCount = forecastList.filter((f) => f.status === "HEALTHY").length;
    const totalSuggestedBudget = forecastList.reduce(
      (acc, f) => acc + f.suggestedReorderQuantity * f.unitPrice,
      0
    );

    return { criticalCount, recommendedCount, healthyCount, totalSuggestedBudget };
  }, [forecastList]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-6 shadow-sm">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold shadow-xs shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Moteur IA WakatAI • Algorithme 30 Jours
              </span>
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
              Prévisions & Réapprovisionnement de Stock
            </h3>
          </div>
        </div>

        {onOpenComparator && (
          <button
            onClick={onOpenComparator}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-sm shadow-emerald-900/20"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Sourcing B2B Fournisseurs</span>
          </button>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Ruptures Imminentes</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
            {stats.criticalCount} <span className="text-xs font-normal">produit(s)</span>
          </p>
          <span className="text-[10px] text-rose-600/80 font-medium">Stock &lt; 7 jours d'autonomie</span>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Réappro. Recommandé</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {stats.recommendedCount} <span className="text-xs font-normal">produit(s)</span>
          </p>
          <span className="text-[10px] text-amber-600/80 font-medium">Seuil de commande atteint</span>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Stock Serein</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {stats.healthyCount} <span className="text-xs font-normal">produit(s)</span>
          </p>
          <span className="text-[10px] text-emerald-600/80 font-medium">Autonomie &gt; 14 jours</span>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Budget Réappro. Est.</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-lg font-black text-blue-700 dark:text-blue-300 mt-1 font-mono">
            {formatCFA(stats.totalSuggestedBudget)}
          </p>
          <span className="text-[10px] text-blue-600/80 font-medium">Couverture {targetCoverageDays} jours</span>
        </div>
      </div>

      {/* Control Sliders & Parameter Customization */}
      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
          <Sliders className="w-4 h-4 text-emerald-500" />
          <span>Ajuster les Paramètres de l'Algorithme :</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Supplier Lead Time */}
          <div className="space-y-1">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Délai de livraison Fournisseur :</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {leadTimeDays} jour(s)
              </strong>
            </div>
            <input
              type="range"
              min="1"
              max="21"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Target Stock Coverage */}
          <div className="space-y-1">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Couverture Cible souhaitée :</span>
              <strong className="text-amber-600 dark:text-amber-400 font-bold">
                {targetCoverageDays} jour(s)
              </strong>
            </div>
            <input
              type="range"
              min="14"
              max="90"
              value={targetCoverageDays}
              onChange={(e) => setTargetCoverageDays(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {[
          { key: "ALL", label: "Tous les Produits" },
          { key: "CRITICAL", label: "🚨 Rupture Imminente" },
          { key: "RECOMMENDED", label: "⚠️ Réappro. Recommandé" },
          { key: "HEALTHY", label: "✅ Stock Serein" },
          { key: "OVERSTOCK", label: "📦 Surstock" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterStatus === tab.key
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Forecast Table */}
      <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 uppercase text-[10px] font-black border-b border-zinc-200 dark:border-zinc-800">
              <th className="p-3">Article / Produit</th>
              <th className="p-3">Stock Actuel</th>
              <th className="p-3">Ventes (30j)</th>
              <th className="p-3">Vélocité / Jour</th>
              <th className="p-3">Autonomie Restante</th>
              <th className="p-3 text-amber-600 dark:text-amber-400">Quantité Suggérée</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
            {filteredForecasts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-zinc-500">
                  Aucun produit ne correspond à ce filtre.
                </td>
              </tr>
            ) : (
              filteredForecasts.map((f) => {
                const isCritical = f.status === "CRITICAL";
                const isRecommended = f.status === "RECOMMENDED";

                return (
                  <tr
                    key={f.product.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition ${
                      isCritical ? "bg-rose-500/5" : isRecommended ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <td className="p-3 font-bold">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div>
                          <p className="text-zinc-900 dark:text-white line-clamp-1">{f.product.name}</p>
                          <span className="text-[10px] text-zinc-400">{f.product.category || "Général"}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 font-bold font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-md ${
                          f.currentStock <= 0
                            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {f.currentStock} {f.product.unit || "unités"}
                      </span>
                    </td>

                    <td className="p-3 font-bold font-mono text-zinc-600 dark:text-zinc-400">
                      {f.quantitySold30Days} unités
                    </td>

                    <td className="p-3 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {f.dailySalesRate.toFixed(1)} / jour
                    </td>

                    <td className="p-3 font-bold">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          isCritical
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : isRecommended
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {f.daysRemaining >= 999
                          ? "Stock Inactif"
                          : `${f.daysRemaining} jour(s)`}
                      </span>
                    </td>

                    <td className="p-3 font-black font-mono text-amber-600 dark:text-amber-400">
                      {f.suggestedReorderQuantity > 0 ? (
                        <span className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                          +{f.suggestedReorderQuantity} {f.product.unit || "unités"}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal">0 (Stock Suffisant)</span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {f.suggestedReorderQuantity > 0 ? (
                        <button
                          onClick={() =>
                            onOpenReorderModal && onOpenReorderModal(f.product, f.suggestedReorderQuantity)
                          }
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5 ml-auto"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Réapprovisionner</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-medium">Conforme</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
