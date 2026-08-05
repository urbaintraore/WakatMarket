import React, { useState, useMemo } from "react";
import {
  X,
  Package,
  TrendingUp,
  TrendingDown,
  Scale,
  Box,
  QrCode,
  Barcode,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Info,
  Sliders,
  Layers
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { Product, InventoryItem } from "../types";
import { formatCFA } from "../data";

interface ProductDetailModalProps {
  product: Product;
  inventoryItem?: InventoryItem;
  onClose: () => void;
  onOrderProduct?: (product: Product) => void;
}

export function ProductDetailModal({
  product,
  inventoryItem,
  onClose,
  onOrderProduct
}: ProductDetailModalProps) {
  const [periodDays, setPeriodDays] = useState<30 | 14 | 7>(30);
  const [showSellingPrice, setShowSellingPrice] = useState(true);
  const [showBuyingPrice, setShowBuyingPrice] = useState(true);

  // Current base prices
  const currentSellingPrice = inventoryItem?.price || product.prixDetail || product.prixGros || 5000;
  const currentBuyingPrice = product.prixGros || Math.round(currentSellingPrice * 0.75);

  // Generate deterministic 30-day price history
  const full30DayHistory = useMemo(() => {
    const history = [];
    const now = new Date();
    // Use product ID to seed slight pseudo-random variations so every product has a unique curve
    let seed = 0;
    for (let i = 0; i < product.id.length; i++) {
      seed += product.id.charCodeAt(i);
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      const buyingPrice = currentBuyingPrice;
      const sellingPrice = currentSellingPrice;
      const margin = sellingPrice - buyingPrice;
      const marginPercent = Math.round((margin / (sellingPrice || 1)) * 100);

      const dayLabel = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      const fullDate = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

      history.push({
        date: dayLabel,
        fullDate,
        prixAchat: buyingPrice,
        prixVente: sellingPrice,
        marge: margin,
        margePercent: marginPercent,
      });
    }
    return history;
  }, [product, currentSellingPrice, currentBuyingPrice]);

  // Filter history based on selected period
  const chartData = useMemo(() => {
    return full30DayHistory.slice(-periodDays);
  }, [full30DayHistory, periodDays]);

  // Summary stats
  const stats = useMemo(() => {
    const buyingPrices = chartData.map((d) => d.prixAchat);
    const sellingPrices = chartData.map((d) => d.prixVente);
    const margins = chartData.map((d) => d.marge);

    const minAchat = Math.min(...buyingPrices);
    const maxAchat = Math.max(...buyingPrices);
    const minVente = Math.min(...sellingPrices);
    const maxVente = Math.max(...sellingPrices);
    const avgMargin = Math.round(margins.reduce((a, b) => a + b, 0) / margins.length);

    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];
    const sellingChange = ((lastPoint.prixVente - firstPoint.prixVente) / (firstPoint.prixVente || 1)) * 100;
    const buyingChange = ((lastPoint.prixAchat - firstPoint.prixAchat) / (firstPoint.prixAchat || 1)) * 100;

    return {
      minAchat,
      maxAchat,
      minVente,
      maxVente,
      avgMargin,
      sellingChange,
      buyingChange
    };
  }, [chartData]);

  const currentMargin = currentSellingPrice - currentBuyingPrice;
  const currentMarginPercent = Math.round((currentMargin / (currentSellingPrice || 1)) * 100);

  const stockValue = inventoryItem?.stock || 0;
  const thresholdValue = inventoryItem?.threshold || 10;
  const isLowStock = stockValue <= thresholdValue;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header Modal Bar */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                Fiche Produit Détaillée
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Série & Analyse Évolutive des Prix ({periodDays} derniers jours)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Fermer la fiche"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Main Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {/* Image Preview */}
            <div className="flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-150 dark:border-zinc-800 relative group">
              <img
                src={product.image || product.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300"}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-44 object-contain rounded-lg"
              />
              <span className="absolute top-2 left-2 bg-zinc-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                {product.category}
              </span>
            </div>

            {/* General Specs */}
            <div className="md:col-span-2 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-md">
                    {product.brand || "Marque Locale"}
                  </span>
                  {product.expirationDate && (
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Exp: {product.expirationDate}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {product.name}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  {product.description || "Aucune description enregistrée pour ce produit."}
                </p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Conditionnement</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">{product.unit || "Unité"}</span>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Poids / Vol.</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-0.5">{product.weight || 1} kg / {product.volume || 0.01} m³</span>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Code-barres</span>
                  <span className="font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mt-0.5 flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5" /> {product.barcode || "N/A"}
                  </span>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Stock Actuel</span>
                  <span className={`font-bold block mt-0.5 flex items-center gap-1 ${isLowStock ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {isLowStock ? <AlertTriangle className="w-3.5 h-3.5 animate-bounce" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {stockValue} disponible(s)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Pricing Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Prix d'Achat */}
            <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                  Prix d'Achat Moyen
                </span>
                <div className="p-1.5 bg-amber-200/50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-900 dark:text-amber-200">
                  {formatCFA(currentBuyingPrice)}
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1 flex items-center gap-1 font-medium">
                  {stats.buyingChange >= 0 ? (
                    <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center">
                      <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +{stats.buyingChange.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                      <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> {stats.buyingChange.toFixed(1)}%
                    </span>)}
                  sur {periodDays} jours
                </p>
              </div>
            </div>

            {/* Prix de Vente */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                  Prix de Vente Public
                </span>
                <div className="p-1.5 bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                  {formatCFA(currentSellingPrice)}
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1 font-medium">
                  {stats.sellingChange >= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                      <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +{stats.sellingChange.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center">
                      <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> {stats.sellingChange.toFixed(1)}%
                    </span>)}
                  sur {periodDays} jours
                </p>
              </div>
            </div>

            {/* Marge Bénéficiaire */}
            <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider">
                  Marge Brute estimée
                </span>
                <div className="p-1.5 bg-indigo-200/50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg">
                  <Sliders className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-indigo-900 dark:text-indigo-200">
                  {formatCFA(currentMargin)}
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 ml-2 bg-indigo-200/60 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                    {currentMarginPercent}%
                  </span>
                </p>
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-1 font-medium">
                  Marge moyenne 30j: <span className="font-bold">{formatCFA(stats.avgMargin)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* QR Code Generation Section for Boutique Scanning */}
          <div className="bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center gap-6">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-200 shrink-0">
              <QRCodeSVG
                value={JSON.stringify({ id: product.id, name: product.name, price: currentSellingPrice, category: product.category })}
                size={110}
                level={"M"}
                includeMargin={true}
              />
            </div>
            <div className="space-y-2 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <QrCode className="w-4 h-4" />
                </span>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white">QR Code Espace Boutique</h4>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Scannez ce QR code avec un smartphone pour afficher instantanément les spécifications et le prix de <strong className="text-zinc-800 dark:text-zinc-200">{product.name}</strong> dans l'espace boutique.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-1">
                <button
                  onClick={() => {
                    alert(`QR Code pour ${product.name} prêt à être scanné ou affiché en boutique.`);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" /> Afficher / Imprimer le Badge QR
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Recharts 30-Day Price History Chart */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            
            {/* Chart Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Évolution des Prix d'Achat & Vente
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Historique interactif quotidien et suivi des marges sur la période
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Period Selector */}
                <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setPeriodDays(7)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      periodDays === 7
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    7 jours
                  </button>
                  <button
                    onClick={() => setPeriodDays(14)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      periodDays === 14
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    14 jours
                  </button>
                  <button
                    onClick={() => setPeriodDays(30)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      periodDays === 30
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    30 jours
                  </button>
                </div>

                {/* Line Toggles */}
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold">
                  <button
                    onClick={() => setShowSellingPrice(!showSellingPrice)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                      showSellingPrice
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-400"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                    Prix Vente
                  </button>
                  <button
                    onClick={() => setShowBuyingPrice(!showBuyingPrice)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                      showBuyingPrice
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-400"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                    Prix Achat
                  </button>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#71717a" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-xl border border-zinc-800 text-xs space-y-1.5">
                            <p className="font-bold text-zinc-300 border-b border-zinc-800 pb-1 flex items-center justify-between gap-4">
                              <span>📅 {data.fullDate}</span>
                              <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded">
                                Marge: {data.margePercent}%
                              </span>
                            </p>
                            {showSellingPrice && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  Prix de Vente:
                                </span>
                                <span className="font-bold">{formatCFA(data.prixVente)}</span>
                              </div>
                            )}
                            {showBuyingPrice && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  Prix d'Achat:
                                </span>
                                <span className="font-bold">{formatCFA(data.prixAchat)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-4 pt-1 border-t border-zinc-800 text-zinc-400 text-[11px]">
                              <span>Marge brute:</span>
                              <span className="font-bold text-indigo-300">{formatCFA(data.marge)}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={30}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{value}</span>}
                  />

                  {showBuyingPrice && (
                    <Line
                      type="monotone"
                      dataKey="prixAchat"
                      name="Prix d'Achat (CFA)"
                      stroke="#d97706"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: "#d97706" }}
                      activeDot={{ r: 5 }}
                    />
                  )}

                  {showSellingPrice && (
                    <Line
                      type="monotone"
                      dataKey="prixVente"
                      name="Prix de Vente (CFA)"
                      stroke="#059669"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#059669", stroke: "#ffffff", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom 30d Min/Max Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800 text-[11px]">
              <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl">
                <span className="text-zinc-400 block font-medium">Prix d'Achat Min</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{formatCFA(stats.minAchat)}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl">
                <span className="text-zinc-400 block font-medium">Prix d'Achat Max</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{formatCFA(stats.maxAchat)}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl">
                <span className="text-zinc-400 block font-medium">Prix Vente Min</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCFA(stats.minVente)}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl">
                <span className="text-zinc-400 block font-medium">Prix Vente Max</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCFA(stats.maxVente)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Fermer
          </button>

          {onOrderProduct && (
            <button
              onClick={() => {
                onOrderProduct(product);
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2"
            >
              <Package className="w-4 h-4" /> Passer Commande B2B
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
