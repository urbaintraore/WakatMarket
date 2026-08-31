/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, ShoppingBag, Clock, Check, ChevronDown, ChevronUp, 
  Archive, Download, User, MapPin, Phone, Package, ArrowRight, Printer 
} from "lucide-react";
import { Order, Product, UserProfile, OrderStatus } from "../types";
import { formatCFA } from "../data";

export interface WidgetGridProps {
  children: React.ReactNode;
  className?: string;
  minChildWidth?: string;
}

/**
 * WidgetGrid organizes dashboard widgets using responsive CSS Grid auto-fit/minmax.
 * Ensures each widget (Orders, Sales, Stocks) has adequate minimum width to prevent text truncation.
 */
export function WidgetGrid({ children, className = "", minChildWidth = "290px" }: WidgetGridProps) {
  return (
    <div 
      className={`grid gap-4 sm:gap-6 w-full ${className}`}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minChildWidth}), 1fr))`
      }}
    >
      {children}
    </div>
  );
}

export interface WidgetCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isExpanded?: boolean;
}

/**
 * WidgetCard wraps individual dashboard widgets with smooth 'motion' hover animation (scale + subtle shadow).
 */
export function WidgetCard({ children, className = "", onClick, isExpanded = false }: WidgetCardProps) {
  return (
    <motion.div
      whileHover={{ 
        scale: 1.015, 
        boxShadow: "0 12px 28px -5px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)"
      }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors relative ${
        isExpanded ? "col-span-1 md:col-span-2 lg:col-span-2 ring-2 ring-emerald-500/30" : ""
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

export interface OrderWidgetCardProps {
  order: Order;
  products: Product[];
  users?: UserProfile[];
  onUpdateOrderStatus?: (orderId: string, status: OrderStatus) => void;
  onArchiveOrder?: (orderId: string) => void;
  onDownloadPDF?: (order: Order, products: Product[]) => void;
  isArchived?: boolean;
  defaultExpanded?: boolean;
}

/**
 * OrderWidgetCard is an interactive Order widget designed for WidgetGrid.
 * On click, it spans two columns (col-span-2) and displays a detailed summary including the full product list.
 */
export function OrderWidgetCard({
  order,
  products,
  users = [],
  onUpdateOrderStatus,
  onArchiveOrder,
  onDownloadPDF,
  isArchived = false,
  defaultExpanded = false
}: OrderWidgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const buyer = users.find(u => u.id === order.senderId);

  return (
    <motion.div
      layout
      whileHover={{ 
        scale: 1.012, 
        boxShadow: "0 14px 30px -6px rgba(0, 0, 0, 0.09), 0 4px 12px -2px rgba(0, 0, 0, 0.04)"
      }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${
        isExpanded ? "col-span-1 md:col-span-2 ring-2 ring-emerald-500/40 dark:ring-emerald-500/30 shadow-md" : ""
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
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

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
            title={isExpanded ? "Réduire l'aperçu" : "Agrandir sur 2 colonnes avec détails"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Basic summary row (collapsed mode) */}
      {!isExpanded && (
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

      {/* Expanded Detailed Summary View (2 columns span) */}
      <AnimatePresence>
        {isExpanded && (
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
