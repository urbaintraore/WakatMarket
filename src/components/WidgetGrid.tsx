/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, ShoppingBag, Clock, Check, ChevronDown, ChevronUp, 
  Archive, Download, User, MapPin, Phone, Package, ArrowRight, Printer,
  Trash2, Maximize2, Minimize2, Loader2, ArrowUpDown, AlertTriangle, X, RefreshCw
} from "lucide-react";
import { Order, Product, UserProfile, OrderStatus } from "../types";
import { formatCFA } from "../data";

export type SortOrder = "desc" | "asc";

export interface WidgetGridHeaderProps {
  title?: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  count?: number;
  isLoading?: boolean;
  sortOrder?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
  onClearAll?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  filterControls?: React.ReactNode;
  className?: string;
}

/**
 * WidgetGridHeader provides a standardized header bar with:
 * - Title & Count
 * - Minimalist Loading/Sync Spinner
 * - Date Sort Dropdown (Ascending / Descending)
 * - Fullscreen Maximize/Minimize Toggle
 * - Clear All ('Tout supprimer') Button with Confirmation
 */
export function WidgetGridHeader({
  title,
  subtitle,
  icon,
  count,
  isLoading = false,
  sortOrder = "desc",
  onSortChange,
  onClearAll,
  isFullScreen = false,
  onToggleFullScreen,
  filterControls,
  className = ""
}: WidgetGridHeaderProps) {
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleClearConfirm = () => {
    setShowConfirmClear(false);
    if (onClearAll) {
      onClearAll();
    }
  };

  return (
    <div className={`space-y-3 pb-3 border-b border-zinc-150 dark:border-zinc-800/80 ${className}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* Left Title & Status */}
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {typeof title === "string" ? (
                <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  {title}
                  {count !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700">
                      {count}
                    </span>
                  )}
                </h3>
              ) : (
                title
              )}

              {/* Minimalist Sync Loader Indicator */}
              {isLoading && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  Synchronisation...
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Controls: Filter, Sort Dropdown, Fullscreen & Clear All */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
          {filterControls}

          {/* Date Sort Dropdown */}
          {onSortChange && (
            <div className="relative flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <select
                value={sortOrder}
                onChange={(e) => onSortChange(e.target.value as SortOrder)}
                className="bg-transparent font-bold text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer pr-1"
                aria-label="Trier par date"
              >
                <option value="desc">Date : Plus récente ➔ Plus ancienne</option>
                <option value="asc">Date : Plus ancienne ➔ Plus récente</option>
              </select>
            </div>
          )}

          {/* Fullscreen Toggle Button */}
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer border border-zinc-200/80 dark:border-zinc-700"
              title={isFullScreen ? "Quitter le mode plein écran" : "Afficher en plein écran (Fullscreen)"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4 text-emerald-600" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* Clear All Button */}
          {onClearAll && (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-rose-200/60 dark:border-rose-800/40"
              title="Vider rapidement le contenu de ce widget"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Tout supprimer</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal / Banner for 'Tout supprimer' */}
      <AnimatePresence>
        {showConfirmClear && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3 bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Êtes-vous sûr de vouloir <strong>tout supprimer / vider</strong> dans ce widget ? Cette action est immédiate.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleClearConfirm}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Confirmer
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-3 py-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface WidgetGridProps {
  children: React.ReactNode;
  className?: string;
  minChildWidth?: string;
  title?: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  count?: number;
  isLoading?: boolean;
  sortOrder?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
  onClearAll?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  filterControls?: React.ReactNode;
}

/**
 * WidgetGrid organizes dashboard widgets using responsive CSS Grid auto-fit/minmax.
 * Includes optional full header, fullscreen overlay, and sync indicator.
 */
export function WidgetGrid({ 
  children, 
  className = "", 
  minChildWidth = "290px",
  title,
  subtitle,
  icon,
  count,
  isLoading = false,
  sortOrder,
  onSortChange,
  onClearAll,
  isFullScreen: externalFullScreen,
  onToggleFullScreen: externalToggleFullScreen,
  filterControls
}: WidgetGridProps) {
  const [internalFullScreen, setInternalFullScreen] = useState(false);
  const isFullScreen = externalFullScreen !== undefined ? externalFullScreen : internalFullScreen;

  const handleToggleFullScreen = () => {
    if (externalToggleFullScreen) {
      externalToggleFullScreen();
    } else {
      setInternalFullScreen(!internalFullScreen);
    }
  };

  const hasHeader = title || onClearAll || onSortChange || isLoading || filterControls || isFullScreen;

  const content = (
    <div className={`space-y-4 ${isFullScreen ? "w-full max-w-7xl mx-auto p-4 sm:p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-y-auto max-h-[90vh]" : ""}`}>
      {hasHeader && (
        <WidgetGridHeader
          title={title}
          subtitle={subtitle}
          icon={icon}
          count={count}
          isLoading={isLoading}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          onClearAll={onClearAll}
          isFullScreen={isFullScreen}
          onToggleFullScreen={handleToggleFullScreen}
          filterControls={filterControls}
        />
      )}

      {/* Grid Container */}
      <div 
        className={`grid gap-4 sm:gap-6 w-full ${className}`}
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minChildWidth}), 1fr))`
        }}
      >
        {children}
      </div>
    </div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center overflow-y-auto">
        <div className="relative w-full max-w-7xl">
          <button
            onClick={handleToggleFullScreen}
            className="absolute -top-10 right-0 p-2 rounded-full bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 transition cursor-pointer shadow-lg z-10"
            title="Quitter le plein écran (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
          {content}
        </div>
      </div>
    );
  }

  return content;
}

export interface WidgetCardProps {
  key?: React.Key;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isExpanded?: boolean;
  title?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  onClear?: () => void;
  onToggleFullScreen?: () => void;
}

/**
 * WidgetCard wraps individual dashboard widgets with smooth 'motion' hover animation (scale + subtle shadow).
 * Supports header, fullscreen zoom icon, minimalist sync loader, and clear button.
 */
export function WidgetCard({ 
  children, 
  className = "", 
  onClick, 
  isExpanded = false,
  title,
  icon,
  isLoading = false,
  onClear,
  onToggleFullScreen
}: WidgetCardProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFullScreen) {
      onToggleFullScreen();
    } else {
      setIsFullScreen(!isFullScreen);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmClear(true);
  };

  const confirmClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmClear(false);
    if (onClear) onClear();
  };

  const cardContent = (
    <motion.div
      whileHover={!isFullScreen ? { 
        scale: 1.015, 
        boxShadow: "0 12px 28px -5px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)"
      } : {}}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors relative ${
        isExpanded ? "col-span-1 md:col-span-2 lg:col-span-2 ring-2 ring-emerald-500/30" : ""
      } ${className}`}
    >
      {(title || onClear || isLoading || onToggleFullScreen) && (
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-zinc-150 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            {icon}
            {title && <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{title}</h4>}
            {isLoading && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Synchro...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
              title={isFullScreen ? "Réduire le widget" : "Afficher ce widget en plein écran"}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {onClear && (
              <button
                onClick={handleClear}
                className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                title="Vider ce widget"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {showConfirmClear && (
        <div className="mb-3 p-2 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
          <span>Vider ce widget ?</span>
          <div className="flex items-center gap-1">
            <button onClick={confirmClear} className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold text-[10px]">Oui</button>
            <button onClick={(e) => { e.stopPropagation(); setShowConfirmClear(false); }} className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded font-bold text-[10px]">Non</button>
          </div>
        </div>
      )}

      {children}
    </motion.div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center overflow-y-auto">
        <div className="relative w-full max-w-4xl">
          {cardContent}
        </div>
      </div>
    );
  }

  return cardContent;
}

export interface OrderWidgetCardProps {
  key?: React.Key;
  order: Order;
  products: Product[];
  users?: UserProfile[];
  onUpdateOrderStatus?: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: any) => void;
  onArchiveOrder?: (orderId: string) => void;
  onDownloadPDF?: (order: Order, products: Product[]) => void;
  onDeleteOrder?: (orderId: string) => void;
  onDiagnoseDelivery?: (order: Order) => void;
  isArchived?: boolean;
  defaultExpanded?: boolean;
  isLoading?: boolean;
}

/**
 * OrderWidgetCard is an interactive Order widget designed for WidgetGrid.
 * On click, it spans two columns (col-span-2) and displays a detailed summary including the full product list.
 * Supports fullscreen toggle icon, clear/delete button with confirmation, and sync loader.
 */
export function OrderWidgetCard({
  order,
  products,
  users = [],
  onUpdateOrderStatus,
  onArchiveOrder,
  onDownloadPDF,
  onDeleteOrder,
  onDiagnoseDelivery,
  isArchived = false,
  defaultExpanded = false,
  isLoading = false
}: OrderWidgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const buyer = users.find(u => u.id === order.senderId);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmDelete(true);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmDelete(false);
    if (onDeleteOrder) {
      onDeleteOrder(order.id);
    } else if (onArchiveOrder) {
      onArchiveOrder(order.id);
    }
  };

  const cardContent = (
    <motion.div
      layout={!isFullScreen}
      whileHover={!isFullScreen ? { 
        scale: 1.012, 
        boxShadow: "0 14px 30px -6px rgba(0, 0, 0, 0.09), 0 4px 12px -2px rgba(0, 0, 0, 0.04)"
      } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${
        isExpanded && !isFullScreen ? "col-span-1 md:col-span-2 ring-2 ring-emerald-500/40 dark:ring-emerald-500/30 shadow-md" : ""
      } ${isFullScreen ? "w-full max-w-4xl shadow-2xl ring-2 ring-orange-500/40" : ""}`}
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs font-mono text-orange-600 dark:text-orange-400">
                #{order.id}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                order.status === OrderStatus.PENDING 
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse"
                  : order.status === OrderStatus.DELIVERED
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}>
                {order.status}
              </span>
              {isArchived && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  Archivée
                </span>
              )}
              {isLoading && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
              Client : {buyer?.companyName || buyer?.name || order.senderId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Montant Total</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCFA(order.totalAmount)}
            </span>
          </div>

          {/* Fullscreen Icon */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
            title={isFullScreen ? "Quitter le plein écran" : "Afficher en plein écran"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4 text-emerald-600" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Delete / Clear Button */}
          {(onDeleteOrder || onArchiveOrder) && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition cursor-pointer"
              title="Supprimer / Vider cette commande"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Expand/Collapse Toggle Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
            title={isExpanded ? "Réduire l'aperçu" : "Agrandir sur 2 colonnes avec détails"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Confirmation Modal / Banner for Delete */}
      <AnimatePresence>
        {showConfirmDelete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Voulez-vous supprimer / vider cette commande #{order.id} ?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={confirmDelete}
                className="px-2.5 py-1 bg-rose-600 text-white rounded font-bold text-xs hover:bg-rose-500 transition cursor-pointer"
              >
                Confirmer
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(false); }}
                className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded font-bold text-xs hover:bg-zinc-300 transition cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Basic summary row (collapsed mode) */}
      {!isExpanded && !isFullScreen && (
        <div 
          onClick={() => setIsExpanded(true)} 
          className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <span>{order.items.length} produit(s) commandé(s)</span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            Cliquez pour étendre (2 cols) &rarr;
          </span>
        </div>
      )}

      {/* Expanded Detailed Summary View (2 columns span or fullscreen) */}
      <AnimatePresence>
        {(isExpanded || isFullScreen) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-zinc-150 dark:border-zinc-800 space-y-4"
          >
            {/* Extended Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-zinc-50/80 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-200/60 dark:border-zinc-750">
              <div className="space-y-1">
                <p className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-orange-500" />
                  Coordonnées Client :
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">{buyer?.name || "Client WakatMarket"}</p>
                <p className="text-zinc-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {buyer?.phone || "Non spécifié"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  Livraison :
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">{order.deliveryAddress || "Livraison sur site / Comptoir"}</p>
                <p className="text-zinc-500 font-mono text-[10px]">Paiement : {order.paymentMethod} ({order.paymentStatus})</p>
              </div>
            </div>

            {/* Product items detailed list */}
            <div>
              <p className="text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                Liste détaillée des produits commandés ({order.items.length})
              </p>
              <div className="divide-y divide-zinc-150 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                {order.items.map((item, idx) => {
                  const prod = products.find(p => p.id === item.productId);
                  return (
                    <div key={item.productId + "_" + idx} className="p-3 flex items-center justify-between text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <div className="flex items-center gap-3">
                        {prod?.image ? (
                          <img 
                            src={prod.image} 
                            alt={prod.name} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{prod?.name || "Produit WakatMarket"}</p>
                          <p className="text-[10px] text-zinc-500">Réf: {item.productId}</p>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{item.quantity} x {formatCFA(item.priceAtOrder)}</span>
                        <p className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                          = {formatCFA(item.quantity * item.priceAtOrder)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {onArchiveOrder && (
                  <button
                    onClick={() => onArchiveOrder(order.id)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isArchived ? "Désarchiver" : "Archiver"}</span>
                  </button>
                )}

                {onDownloadPDF && (
                  <button
                    onClick={() => onDownloadPDF(order, products)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Facture PDF</span>
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 items-center flex-wrap">
                {order.status === OrderStatus.PENDING && onDiagnoseDelivery && (
                  <button
                    onClick={() => onDiagnoseDelivery(order)}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Diagnostiquer la livraison"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Diagnostiquer</span>
                  </button>
                )}
                {order.status === OrderStatus.PENDING && onUpdateOrderStatus && (
                  <button
                    onClick={() => onUpdateOrderStatus(order.id, OrderStatus.CONFIRMED)}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Valider la commande</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center overflow-y-auto">
        {cardContent}
      </div>
    );
  }

  return cardContent;
}

