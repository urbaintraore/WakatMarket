/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  Download,
  CheckCircle2,
  Sparkles,
  BarChart2,
  Scan,
  Laptop,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
  SlidersHorizontal
} from "lucide-react";

export interface SyncStatusInfo {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  progress?: number;
}

interface QuickActionsBarProps {
  syncStatus: SyncStatusInfo;
  onTriggerSync: () => void;
  onOpenSyncSystemModal: () => void;
  isPWAInstalled: boolean;
  onTriggerPWAInstall: () => void;
  showScanner: boolean;
  onToggleScanner: () => void;
  showAICopilot: boolean;
  onToggleAICopilot: () => void;
  showReports: boolean;
  onToggleReports: () => void;
  onOpenSupport: () => void;
  userRole?: string;
  isCompactByDefault?: boolean;
}

export function QuickActionsBar({
  syncStatus,
  onTriggerSync,
  onOpenSyncSystemModal,
  isPWAInstalled,
  onTriggerPWAInstall,
  showScanner,
  onToggleScanner,
  showAICopilot,
  onToggleAICopilot,
  showReports,
  onToggleReports,
  onOpenSupport,
  userRole,
  isCompactByDefault = false
}: QuickActionsBarProps) {
  const [isExpanded, setIsExpanded] = useState(!isCompactByDefault);

  return (
    <div
      className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-xs transition-all overflow-hidden"
      id="quick-actions-bar"
    >
      {/* Top Bar Header */}
      <div className="p-3.5 sm:p-4 bg-zinc-50/80 dark:bg-zinc-850/60 border-b border-zinc-150 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs sm:text-sm text-zinc-950 dark:text-white tracking-tight">
                Support, Outils & Synchronisation
              </h3>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                Actions Centralisées
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Accès rapide aux services hors-ligne, diagnostic, prévisions IA et documentation
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Quick Support / FAQ trigger */}
          <button
            onClick={onOpenSupport}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            id="quick-support-open-btn"
            title="Ouvrir le Centre de Support & FAQ IA"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Support & FAQ IA</span>
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition cursor-pointer text-xs"
            title={isExpanded ? "Réduire les outils" : "Développer les outils"}
            id="quick-actions-expand-toggle"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Tools Container */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="p-3.5 sm:p-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              
              {/* 1. Synchro OK / Statut Réseau & Supabase */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  !syncStatus.isOnline
                    ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                    : syncStatus.isSyncing
                    ? "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800"
                    : syncStatus.failedCount > 0
                    ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
                    : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Connectivité
                    </span>
                    {!syncStatus.isOnline ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    ) : syncStatus.isSyncing ? (
                      <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    {!syncStatus.isOnline ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-amber-600" /> Mode Hors-Ligne
                      </>
                    ) : syncStatus.isSyncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" /> En Synchronisation
                      </>
                    ) : syncStatus.failedCount > 0 ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Erreur Synchro
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Synchro OK
                      </>
                    )}
                  </h4>
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                    {!syncStatus.isOnline
                      ? `${syncStatus.pendingCount} opération(s) en attente locale.`
                      : syncStatus.isSyncing
                      ? "Envoi des données vers le Cloud..."
                      : syncStatus.failedCount > 0
                      ? `${syncStatus.failedCount} échec(s) à renvoyer.`
                      : "Base locale alignée avec Supabase."}
                  </p>
                </div>
                <button
                  onClick={onTriggerSync}
                  className="mt-3 w-full py-1.5 px-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                  id="quick-sync-trigger-btn"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-600" />
                  <span>Tester & Synchroniser</span>
                </button>
              </div>

              {/* 2. PWA Installable (Hors-ligne OK) */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Application
                    </span>
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-emerald-600" /> PWA Installable
                  </h4>
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                    {isPWAInstalled
                      ? "Application installée sur l'appareil (Plein écran actif)."
                      : "Accès instantané et autonome sans passer par le store."}
                  </p>
                </div>
                <button
                  onClick={onTriggerPWAInstall}
                  className={`mt-3 w-full py-1.5 px-2.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 ${
                    isPWAInstalled
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                  id="quick-pwa-install-btn"
                >
                  {isPWAInstalled ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Installée (Hors-ligne OK)</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      <span>Installer l'App</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3. Sync Système (Diagnostic & File d'attente) */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Moteur ERP
                    </span>
                    <Laptop className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Sync Système
                  </h4>
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                    Diagnostic de persistance, inspection SyncQueue et intégrité.
                  </p>
                </div>
                <button
                  onClick={onOpenSyncSystemModal}
                  className="mt-3 w-full py-1.5 px-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                  id="quick-sync-system-btn"
                >
                  <Laptop className="w-3 h-3 text-indigo-600" />
                  <span>Diagnostiquer</span>
                </button>
              </div>

              {/* 4. IA Forecasting */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Intelligence
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> IA Forecasting
                  </h4>
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                    Prévision des ruptures, réapprovisionnement et tendances.
                  </p>
                </div>
                <button
                  onClick={onToggleAICopilot}
                  className={`mt-3 w-full py-1.5 px-2.5 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                    showAICopilot
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                  }`}
                  id="quick-ai-forecasting-btn"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{showAICopilot ? "Fermer IA" : "Lancer IA"}</span>
                </button>
              </div>

              {/* 5. Rapport Analytique */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Finance & CA
                    </span>
                    <BarChart2 className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-rose-600" /> Rapport Analytique
                  </h4>
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                    Chiffre d'Affaires, marges nettes, créances et bilans exportables.
                  </p>
                </div>
                <button
                  onClick={onToggleReports}
                  className={`mt-3 w-full py-1.5 px-2.5 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                    showReports
                      ? "bg-rose-600 text-white"
                      : "bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                  }`}
                  id="quick-reports-btn"
                >
                  <BarChart2 className="w-3 h-3 text-rose-600" />
                  <span>{showReports ? "Fermer Bilans" : "Ouvrir Bilans"}</span>
                </button>
              </div>

              {/* 6. Scanner Code-barres */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Caisse & Stock
                    </span>
                    <Scan className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <Scan className="w-3.5 h-3.5 text-emerald-600" /> Scanner Code-barres
                  </h4>
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                    Saisie optique par caméra pour encaissements POS et inventaires.
                  </p>
                </div>
                <button
                  onClick={onToggleScanner}
                  className={`mt-3 w-full py-1.5 px-2.5 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs ${
                    showScanner
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                  }`}
                  id="quick-scanner-btn"
                >
                  <Scan className="w-3 h-3 text-emerald-600" />
                  <span>{showScanner ? "Fermer Scanner" : "Activer Caméra"}</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
