/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Brain, Sparkles, TrendingUp, AlertTriangle, ArrowRight, CheckCircle, Percent, Compass, Sun, ShoppingCart } from "lucide-react";
import { AIRecommendation, Product, InventoryItem } from "../types";
import { triggerAIAnalysis, formatCFA } from "../data";

interface AICopilotProps {
  products: Product[];
  inventory: InventoryItem[];
  onApplyRecommendation?: (rec: AIRecommendation) => void;
  userRole: string;
}

export default function AICopilot({ products, inventory, onApplyRecommendation, userRole }: AICopilotProps) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(() =>
    triggerAIAnalysis(inventory, products)
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<Record<string, boolean>>({});

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      // Re-trigger analysis based on current state
      const freshRecs = triggerAIAnalysis(inventory, products);
      setRecommendations(freshRecs);
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleApply = (rec: AIRecommendation) => {
    setAppliedRecs((prev) => ({ ...prev, [rec.id]: true }));
    if (onApplyRecommendation) {
      onApplyRecommendation(rec);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "RESTOCK":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "DEMAND_FORECAST":
        return <TrendingUp className="w-5 h-5 text-emerald-500" />;
      case "PROMOTION":
        return <Percent className="w-5 h-5 text-indigo-500" />;
      case "ROUTE_OPTIMIZATION":
        return <Compass className="w-5 h-5 text-blue-500" />;
      default:
        return <Brain className="w-5 h-5 text-pink-500" />;
    }
  };

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-2xl border border-zinc-800 p-6 shadow-2xl relative overflow-hidden" id="ai-copilot-module">
      {/* Decorative ambient blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-zinc-800/80 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> IA Copilot Active
            </span>
          </div>
          <h3 className="text-lg font-bold tracking-tight">Prévisions & Recommandations Prédictives</h3>
          <p className="text-zinc-400 text-xs mt-0.5">
            Analyse intelligente de la chaîne de distribution (Météo, Saisonnalité, Historiques de ventes)
          </p>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer flex-shrink-0"
          id="trigger-ai-btn"
        >
          {isAnalyzing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Calculs IA...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" /> Recalculer l'Analyse
            </>
          )}
        </button>
      </div>

      {/* Quick context stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 relative z-10">
        <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-medium">Seuils Critiques Franchis</p>
            <p className="text-sm font-bold text-amber-400">
              {inventory.filter((i) => i.stock <= i.threshold).length} Articles
            </p>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-medium">Facteur Climatique Activé</p>
            <p className="text-sm font-bold text-emerald-400">Canicule Abidjan (+32%)</p>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-medium">Fiabilité Globale des Modèles</p>
            <p className="text-sm font-bold text-indigo-400">93.4 % (Confiance)</p>
          </div>
        </div>
      </div>

      {/* Recommendations Feed */}
      <div className="space-y-3 relative z-10">
        {recommendations.length === 0 ? (
          <div className="text-center py-8 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-xs text-zinc-500">Aucune préconisation critique pour l'instant. Vos stocks sont équilibrés !</p>
          </div>
        ) : (
          recommendations.map((rec) => {
            const isApplied = appliedRecs[rec.id];
            const product = products.find((p) => p.id === rec.targetId);

            return (
              <div
                key={rec.id}
                className={`bg-zinc-900/40 hover:bg-zinc-900/80 border transition rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  isApplied ? "border-zinc-800 opacity-60" : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex gap-3 items-start min-w-0">
                  <div className="p-2 bg-zinc-850 rounded-lg flex-shrink-0 mt-0.5">
                    {getIcon(rec.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-xs text-zinc-100">{rec.title}</h4>
                      <span className="text-[9px] bg-zinc-800 text-zinc-300 font-medium px-1.5 py-0.5 rounded-full">
                        Fiabilité: {rec.confidence}%
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      {rec.description}
                    </p>
                    {rec.metrics && (
                      <div className="flex gap-4 mt-2 text-[10px] text-emerald-400 font-medium bg-zinc-950/50 px-2.5 py-1 rounded border border-zinc-900 w-fit">
                        {rec.metrics.currentStock !== undefined && (
                          <span>Stock Actuel: {rec.metrics.currentStock}</span>
                        )}
                        {rec.metrics.recommendedQty !== undefined && (
                          <span className="text-amber-400">Conseillé: +{rec.metrics.recommendedQty} units</span>
                        )}
                        {rec.metrics.estimatedVentesGrowth !== undefined && (
                          <span className="text-indigo-400">Croissance Prévue: +{rec.metrics.estimatedVentesGrowth}%</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 w-full md:w-auto flex md:flex-col items-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-850">
                  {isApplied ? (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1.5 bg-zinc-850 px-3 py-1.5 rounded-lg w-full md:w-auto justify-center">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Action Enregistrée
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApply(rec)}
                      className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-3.5 py-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer w-full md:w-auto justify-center border border-emerald-500/30 hover:border-transparent"
                      id={`apply-rec-btn-${rec.id}`}
                    >
                      {rec.type === "RESTOCK" ? (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5" /> Réapprovisionner
                        </>
                      ) : (
                        <>
                          <span>Appliquer la reco</span> <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
