/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Scan, ShoppingBag, Clock, DollarSign, Barcode, TrendingUp, 
  Check, ArrowRight, Package, Smartphone, AlertCircle, Archive, Filter 
} from "lucide-react";
import { motion } from "motion/react";
import { Order, Product, OrderStatus, UserProfile } from "../types";
import { formatCFA } from "../data";
import BarcodeScanner from "./BarcodeScanner";
import { WidgetGrid, OrderWidgetCard, SortOrder } from "./WidgetGrid";

interface MerchantSalesDashboardProps {
  orders: Order[];
  products: Product[];
  currentUser: UserProfile;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string) => void;
  onPlaceSale?: (buyerId: string, items: { productId: string; quantity: number }[], amountPaid: number, method: string) => void;
  isLoading?: boolean;
}

export default function MerchantSalesDashboard({
  orders,
  products,
  currentUser,
  onUpdateOrderStatus,
  onPlaceSale,
  isLoading = false
}: MerchantSalesDashboardProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Persistent Archive State
  const [archivedOrderIds, setArchivedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("wakat_archived_order_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filter mode: 'active_only' (default), 'all', 'archived'
  const [orderFilterMode, setOrderFilterMode] = useState<"active_only" | "all" | "archived">("active_only");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const toggleArchiveOrder = (orderId: string) => {
    setArchivedOrderIds(prev => {
      const isArchived = prev.includes(orderId);
      const updated = isArchived ? prev.filter(id => id !== orderId) : [...prev, orderId];
      try {
        localStorage.setItem("wakat_archived_order_ids", JSON.stringify(updated));
      } catch (e) {
        console.warn("Error saving archived order IDs:", e);
      }
      return updated;
    });
  };

  // Merchant incoming orders
  const myIncomingOrders = useMemo(() => {
    return orders.filter(o => o.receiverId === currentUser.id || o.receiverId === currentUser.email);
  }, [orders, currentUser.id, currentUser.email]);

  const activeOrders = useMemo(() => {
    return myIncomingOrders.filter(o => !archivedOrderIds.includes(o.id));
  }, [myIncomingOrders, archivedOrderIds]);

  const archivedOrders = useMemo(() => {
    return myIncomingOrders.filter(o => archivedOrderIds.includes(o.id));
  }, [myIncomingOrders, archivedOrderIds]);

  const displayedOrders = useMemo(() => {
    if (orderFilterMode === "active_only") return activeOrders;
    if (orderFilterMode === "archived") return archivedOrders;
    return myIncomingOrders;
  }, [orderFilterMode, activeOrders, archivedOrders, myIncomingOrders]);

  const sortedDisplayedOrders = useMemo(() => {
    const list = [...displayedOrders];
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [displayedOrders, sortOrder]);

  const handleClearAllDisplayedOrders = () => {
    const idsToArchive = sortedDisplayedOrders.map(o => o.id);
    setArchivedOrderIds(prev => {
      const updated = Array.from(new Set([...prev, ...idsToArchive]));
      try {
        localStorage.setItem("wakat_archived_order_ids", JSON.stringify(updated));
      } catch (e) {
        console.warn("Error saving archived order IDs:", e);
      }
      return updated;
    });
  };

  // Compute Today's Revenue
  const todayRevenue = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return orders
      .filter(o => {
        if (!o.createdAt) return false;
        const isMySale = o.receiverId === currentUser.id;
        const orderDate = new Date(o.createdAt).toISOString().split("T")[0];
        const isValid = o.status !== "CANCELLED" && (o.status as string) !== "annulee";
        return isMySale && orderDate === today && isValid;
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [orders, currentUser.id]);

  // Compute Pending Orders for this merchant
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.receiverId === currentUser.id && o.status === OrderStatus.PENDING);
  }, [orders, currentUser.id]);

  // Compute all sales today
  const todaySalesCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const isMySale = o.receiverId === currentUser.id;
      const orderDate = new Date(o.createdAt).toISOString().split("T")[0];
      return isMySale && orderDate === today;
    }).length;
  }, [orders, currentUser.id]);

  const handleScanSuccess = (product: Product, code: string) => {
    setScannedProduct(product);
    setScanMessage(`Produit ${product.name} détecté avec succès ! Code: ${code}`);
    setTimeout(() => {
      setScanMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* Upper overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CA du jour */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 p-5 rounded-2xl text-white shadow-md relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-15">
            <DollarSign className="w-20 h-20" />
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-100" />
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Chiffre d'Affaires (Aujourd'hui)</span>
          </div>
          <p className="text-3xl font-black font-mono mt-3">{formatCFA(todayRevenue)}</p>
          <p className="text-[11px] text-emerald-50 mt-2 font-medium">Basé sur {todaySalesCount} ventes enregistrées ce jour</p>
        </div>

        {/* Commandes en attente */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Commandes en attente</span>
              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
            </div>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-3 font-mono">{pendingOrders.length}</p>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">Nécessite votre validation pour expédition</p>
        </div>

        {/* Accès rapide Scanner */}
        <div 
          onClick={() => setShowScanner(!showScanner)}
          className="bg-zinc-900 dark:bg-zinc-950 border border-zinc-850 p-5 rounded-2xl text-white shadow-sm flex flex-col justify-between cursor-pointer hover:bg-zinc-800 transition group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Scanner de Code-barres</span>
              <Scan className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-sm font-semibold text-emerald-400 mt-3 flex items-center gap-1.5">
              <Barcode className="w-5 h-5 animate-pulse" />
              {showScanner ? "Fermer le viseur" : "Lancer le scanner"}
            </p>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">Scannez un produit pour vérifier ses stocks ou l'ajouter aux ventes</p>
        </div>
      </div>

      {/* Barcode Scanner Embedded widget */}
      {showScanner && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800"
        >
          <BarcodeScanner 
            products={products} 
            onScanSuccess={handleScanSuccess} 
            onClose={() => setShowScanner(false)} 
          />

          {scannedProduct && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-4 p-4 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-950/40 rounded-xl max-w-md mx-auto"
            >
              <div className="flex items-start gap-3">
                <img 
                  src={scannedProduct.image} 
                  alt={scannedProduct.name} 
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover border border-zinc-100" 
                />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{scannedProduct.name}</h4>
                    <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-mono font-bold">
                      {scannedProduct.barcode}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Catégorie : {scannedProduct.category}</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCFA(scannedProduct.prixGros)} (Gros)</p>
                </div>
              </div>
            </motion.div>
          )}

          {scanMessage && (
            <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs text-center font-bold">
              {scanMessage}
            </div>
          )}
        </motion.div>
      )}

      {/* Orders List & Interactive WidgetGrid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        {sortedDisplayedOrders.length === 0 ? (
          <div className="space-y-4">
            <WidgetGrid
              title="Commandes Clients Reçues"
              subtitle="Cliquez sur une carte pour l'étendre sur 2 colonnes et afficher le résumé détaillé."
              icon={<ShoppingBag className="w-4 h-4 text-emerald-600" />}
              count={0}
              isLoading={isLoading}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              onClearAll={sortedDisplayedOrders.length > 0 ? handleClearAllDisplayedOrders : undefined}
              filterControls={
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setOrderFilterMode("active_only")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderFilterMode === "active_only"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                    title="Affiche uniquement les commandes non archivées"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Actives</span>
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-black/20 rounded-full font-mono">{activeOrders.length}</span>
                  </button>

                  <button
                    onClick={() => setOrderFilterMode("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderFilterMode === "all"
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                  >
                    <span>Toutes</span>
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-black/20 rounded-full font-mono">{myIncomingOrders.length}</span>
                  </button>

                  <button
                    onClick={() => setOrderFilterMode("archived")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderFilterMode === "archived"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archives ({archivedOrders.length})</span>
                  </button>
                </div>
              }
              minChildWidth="300px"
            >
              <div className="col-span-full text-center py-10 text-zinc-500 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {orderFilterMode === "active_only" && "Aucune commande active en cours."}
                  {orderFilterMode === "archived" && "Aucune commande dans les archives."}
                  {orderFilterMode === "all" && "Aucune commande enregistrée."}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">Les dossiers de commandes apparaîtront ici.</p>
              </div>
            </WidgetGrid>
          </div>
        ) : (
          <WidgetGrid 
            title="Commandes Clients Reçues"
            subtitle="Cliquez sur une carte pour l'étendre sur 2 colonnes et afficher le résumé détaillé."
            icon={<ShoppingBag className="w-4 h-4 text-emerald-600" />}
            count={sortedDisplayedOrders.length}
            isLoading={isLoading}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            onClearAll={handleClearAllDisplayedOrders}
            filterControls={
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setOrderFilterMode("active_only")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    orderFilterMode === "active_only"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                  title="Affiche uniquement les commandes non archivées"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Actives</span>
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-black/20 rounded-full font-mono">{activeOrders.length}</span>
                </button>

                <button
                  onClick={() => setOrderFilterMode("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    orderFilterMode === "all"
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  <span>Toutes</span>
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-black/20 rounded-full font-mono">{myIncomingOrders.length}</span>
                </button>

                <button
                  onClick={() => setOrderFilterMode("archived")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    orderFilterMode === "archived"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archives ({archivedOrders.length})</span>
                </button>
              </div>
            }
            minChildWidth="300px"
          >
            {sortedDisplayedOrders.map(order => (
              <OrderWidgetCard
                key={order.id}
                order={order}
                products={products}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onArchiveOrder={toggleArchiveOrder}
                isArchived={archivedOrderIds.includes(order.id)}
                isLoading={isLoading}
              />
            ))}
          </WidgetGrid>
        )}
      </div>
    </div>
  );
}
