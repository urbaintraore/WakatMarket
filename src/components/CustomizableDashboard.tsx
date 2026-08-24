import React, { useState, useEffect } from "react";
import { 
  LayoutGrid, Settings2, GripVertical, Eye, EyeOff, 
  ArrowUp, ArrowDown, RotateCcw, Check, Sparkles, SlidersHorizontal,
  TrendingUp, BarChart3, AlertTriangle, ShieldCheck, ShoppingBag, DollarSign, RefreshCw
} from "lucide-react";
import { UserProfile, Product, Order, DebtPayment, LightClient } from "../types";
import { 
  ThirtyDaySalesAndStockChart, LowStockAlerts, WeeklySalesChart, 
  DebtVsRevenueChart, StockEvolutionBarChart, ClaimsSummaryWidget 
} from "./CommonDashboardParts";
import { StockForecastModule } from "./StockForecastModule";

export interface WidgetConfig {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  width: "HALF" | "FULL";
  iconName: string;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: "sales_30d_chart",
    title: "Graphique des Ventes (30 Jours)",
    description: "Évolution quotidienne du chiffre d'affaires et des volumes vendus",
    enabled: true,
    width: "FULL",
    iconName: "TrendingUp"
  },
  {
    id: "stock_forecast",
    title: "Prévisions de Réapprovisionnement IA",
    description: "Algorithme 30 jours et suggestion automatique de commandes",
    enabled: true,
    width: "FULL",
    iconName: "Sparkles"
  },
  {
    id: "debt_revenue_chart",
    title: "Évolution des Marges & Bilan de l'Ardoise",
    description: "Comparaison entre ventes comptant et crédit client accordé",
    enabled: true,
    width: "HALF",
    iconName: "BarChart3"
  },
  {
    id: "low_stock_alerts",
    title: "Alertes de Stock Critique & Péremptions",
    description: "Détection préventive des ruptures et produits à péremption proche",
    enabled: true,
    width: "HALF",
    iconName: "AlertTriangle"
  },
  {
    id: "stock_evolution_bar",
    title: "Évolution Mensuelle des Stocks & Réassorts",
    description: "Statistiques d'entrées et sorties de marchandises",
    enabled: true,
    width: "HALF",
    iconName: "BarChart3"
  },
  {
    id: "claims_summary",
    title: "Synthèse des Réclamations & Retours",
    description: "Suivi des litiges marchands et validations de livraison",
    enabled: true,
    width: "HALF",
    iconName: "ShieldCheck"
  }
];

interface CustomizableDashboardProps {
  currentUser: UserProfile;
  products: Product[];
  orders: Order[];
  payments?: DebtPayment[];
  lightClients?: LightClient[];
  onOpenReorderModal?: (product: Product, suggestedQty: number) => void;
  onOpenComparator?: () => void;
}

export function CustomizableDashboard({
  currentUser,
  products,
  orders,
  payments = [],
  lightClients = [],
  onOpenReorderModal,
  onOpenComparator
}: CustomizableDashboardProps) {
  const localStorageKey = `wakat_dashboard_widgets_${currentUser.id}`;

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load custom widget preferences:", e);
    }
    return DEFAULT_WIDGETS;
  });

  const [isEditingMode, setIsEditingMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Save changes to localStorage whenever widgets state updates
  useEffect(() => {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(widgets));
    } catch (e) {
      console.error("Failed to save custom widget preferences:", e);
    }
  }, [widgets, localStorageKey]);

  // Toggle widget visibility
  const toggleWidgetEnabled = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  // Toggle widget layout width (HALF vs FULL)
  const toggleWidgetWidth = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, width: w.width === "FULL" ? "HALF" : "FULL" } : w
      )
    );
  };

  // Move widget up in order
  const moveWidgetUp = (index: number) => {
    if (index <= 0) return;
    setWidgets((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Move widget down in order
  const moveWidgetDown = (index: number) => {
    if (index >= widgets.length - 1) return;
    setWidgets((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setWidgets((prev) => {
      const copy = [...prev];
      const draggedItem = copy[draggedIndex];
      copy.splice(draggedIndex, 1);
      copy.splice(index, 0, draggedItem);
      return copy;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Reset layout to defaults
  const handleResetLayout = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  // Filter products for current merchant
  const userProducts = products.filter((p) => p.creatorId === currentUser.id || (p as any).ownerId === currentUser.id);

  // Render individual widget component by ID
  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case "sales_30d_chart":
        return <ThirtyDaySalesAndStockChart products={userProducts} orders={orders} currentUserId={currentUser.id} />;

      case "stock_forecast":
        return (
          <StockForecastModule
            products={products}
            orders={orders}
            currentUser={currentUser}
            onOpenReorderModal={onOpenReorderModal}
            onOpenComparator={onOpenComparator}
          />
        );

      case "debt_revenue_chart":
        return <DebtVsRevenueChart orders={orders} currentUserId={currentUser.id} payments={payments} lightClients={lightClients} />;

      case "low_stock_alerts":
        return <LowStockAlerts products={userProducts} orders={orders} currentUserId={currentUser.id} />;

      case "stock_evolution_bar":
        return <StockEvolutionBarChart products={userProducts} orders={orders} currentUserId={currentUser.id} />;

      case "claims_summary":
        return <ClaimsSummaryWidget orders={orders} currentUserId={currentUser.id} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Control Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
              Tableau de Bord Personnalisable
            </h3>
            <p className="text-xs text-zinc-500">
              Glissez-déposez ou activez les widgets de données pour organiser votre vue commerciale.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditingMode && (
            <button
              onClick={handleResetLayout}
              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Réinitialiser la disposition par défaut"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
            </button>
          )}

          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs ${
              isEditingMode
                ? "bg-amber-600 text-white shadow-amber-900/20"
                : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>{isEditingMode ? "Valider le Mode Personnalisation" : "Personnaliser les Widgets"}</span>
          </button>
        </div>
      </div>

      {/* Editing Drawer Panel when customization mode is active */}
      {isEditingMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5 space-y-4 animate-[fadeIn_0.2s_ease]">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                Configuration & Réorganisation des Widgets
              </h4>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
              Utilisez les flèches ou glissez-déposez pour réordonner
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {widgets.map((widget, index) => (
              <div
                key={widget.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`bg-white dark:bg-zinc-900 border p-3 rounded-xl flex items-center justify-between gap-3 shadow-2xs transition-all ${
                  draggedIndex === index
                    ? "border-amber-500 ring-2 ring-amber-500/30 opacity-60"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 p-1">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                      {widget.title}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">{widget.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Up / Down Controls for Touch/Accessibility */}
                  <button
                    onClick={() => moveWidgetUp(index)}
                    disabled={index === 0}
                    className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-zinc-200 cursor-pointer"
                    title="Déplacer vers le haut"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => moveWidgetDown(index)}
                    disabled={index === widgets.length - 1}
                    className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-zinc-200 cursor-pointer"
                    title="Déplacer vers le bas"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Width Toggle */}
                  <button
                    onClick={() => toggleWidgetWidth(widget.id)}
                    className="px-2 py-1 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer"
                    title="Changer la largeur du widget"
                  >
                    {widget.width === "FULL" ? "Plein Écran" : "1/2 Écran"}
                  </button>

                  {/* Enable / Disable Toggle */}
                  <button
                    onClick={() => toggleWidgetEnabled(widget.id)}
                    className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      widget.enabled
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                    }`}
                    title={widget.enabled ? "Masquer ce widget" : "Afficher ce widget"}
                  >
                    {widget.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Render Active Dashboard Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {widgets
          .filter((w) => w.enabled)
          .map((widget) => {
            const isFullWidth = widget.width === "FULL";
            return (
              <div
                key={widget.id}
                className={`transition-all duration-300 ${
                  isFullWidth ? "md:col-span-2" : "md:col-span-1"
                }`}
              >
                {renderWidgetContent(widget.id)}
              </div>
            );
          })}
      </div>
    </div>
  );
}
