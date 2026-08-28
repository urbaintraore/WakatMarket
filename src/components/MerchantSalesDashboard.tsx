/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Scan, ShoppingBag, Clock, DollarSign, Barcode, TrendingUp, 
  Check, ArrowRight, Package, Smartphone, AlertCircle 
} from "lucide-react";
import { motion } from "motion/react";
import { Order, Product, OrderStatus, UserProfile } from "../types";
import { formatCFA } from "../data";
import BarcodeScanner from "./BarcodeScanner";

interface MerchantSalesDashboardProps {
  orders: Order[];
  products: Product[];
  currentUser: UserProfile;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string) => void;
  onPlaceSale?: (buyerId: string, items: { productId: string; quantity: number }[], amountPaid: number, method: string) => void;
}

export default function MerchantSalesDashboard({
  orders,
  products,
  currentUser,
  onUpdateOrderStatus,
  onPlaceSale
}: MerchantSalesDashboardProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Compute Today's Revenue
  const todayRevenue = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return orders
      .filter(o => {
        if (!o.createdAt) return false;
        // Check if the current user is the receiver/seller of this order
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

      {/* Pending Orders List Quick View */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-150 dark:border-zinc-800/80">
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Commandes en attente de validation ({pendingOrders.length})
          </h3>
          <span className="text-xs text-zinc-500 font-semibold">Vue rapide marchand</span>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-semibold">Toutes les commandes ont été traitées !</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingOrders.map(order => (
              <div key={order.id} className="p-4 bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 rounded-xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-mono">
                      #{order.id}
                    </span>
                    <span className="text-xs text-zinc-500 font-semibold">
                      Par: {order.senderId}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white mt-1.5">
                    {order.items.length} article(s) • Total: {formatCFA(order.totalAmount)}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Adresse : {order.deliveryAddress || "Comptoir"}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateOrderStatus(order.id, OrderStatus.CONFIRMED)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    Accepter & Confirmer
                  </button>
                  <button
                    onClick={() => onUpdateOrderStatus(order.id, OrderStatus.CANCELLED)}
                    className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
