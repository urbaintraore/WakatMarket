/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Users, Shield, Landmark, MapPin, Truck, ShoppingCart, ShoppingBag, 
  Settings, UserCheck, UserX, ToggleLeft, ToggleRight, Plus, Tag, 
  BarChart, Sparkles, Check, Play, Map, Navigation, CheckCircle, 
  Camera, PenTool, Star, AlertCircle, RefreshCw, Layers, Bell, Eye, EyeOff,
  Upload, Link as LinkIcon, Trash2, Cloud, CloudOff, AlertTriangle, BookOpen, Calculator, History, Search, Filter, MoreVertical, LayoutGrid, List, TrendingUp, TrendingDown, DollarSign, Box, Briefcase, User, Store, Factory, CreditCard, ExternalLink, Download, Printer, Share2, MessageSquare, Send, Zap, Lock, Unlock, FileText, X, Package, Save, Wallet, Calendar, Archive
} from "lucide-react";
import { UserRole, UserProfile, Product, InventoryItem, Order, OrderStatus, ChatMessage, StockMovement, LightClient, DebtPayment, Connection, isConnectionActive, isBonkoungou } from "../types";
import { formatCFA, estimateShipping, generateOTP, calculateClientDebt, calculateApplicablePrice } from "../data";
import { inventoryService } from "../services/inventoryService";
import { venteService } from "../services/venteService";
import { orderService } from "../services/orderService";
import { OrderClaimAndConfirm } from "./OrderClaimAndConfirm";
import { SyncStatusIndicator, LowStockAlerts, ClientManagement, SyncHistory, WeeklySalesChart, DebtVsRevenueChart, SupplierSelector, ThirtyDaySalesAndStockChart, ExpirationAlertsBanner, ClaimsSummaryWidget, StockEvolutionBarChart, handleExportInventoryCSV, handleExportSalesCSV, SalesExportButton } from "./CommonDashboardParts";
import { AccountingDashboard } from "./AccountingDashboard";
import { PredictiveSearchBar } from "./PredictiveSearchBar";
import { POSComponent } from "./POSComponent";
import { CaisseModule } from "./CaisseModule";
import { MyBuyersModule } from "./MyBuyersModule";
import { AdminUserEditModal } from "./AdminUserEditModal";
import { EditProductStockModal } from "./EditProductStockModal";
import { CreateProductModal } from "./CreateProductModal";
import { StockCategoryOrganizer } from "./StockCategoryOrganizer";
import { B2BProductComparator } from "./B2BProductComparator";
import { StockForecastModule } from "./StockForecastModule";
import { CustomizableDashboard } from "./CustomizableDashboard";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { PriceRangeSlider } from "./PriceRangeSlider";
import { FavoritesSection } from "./FavoritesSection";
import { OrderCreationDeliveryCalculator } from "./OrderCreationDeliveryCalculator";
import { PartnerReviewsSection } from "./PartnerReviewsSection";
import MerchantSalesDashboard from "./MerchantSalesDashboard";
import { WidgetGrid, WidgetCard, OrderWidgetCard, SortOrder } from "./WidgetGrid";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
// ----------------------------------------------------------------------
// Re-usable Responsive Tab Bar Component (All tabs fully visible)
// ----------------------------------------------------------------------
export interface DashboardTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: string;
  highlight?: boolean;
}
export interface DashboardTabBarProps {
  title?: string;
  tabs: DashboardTabItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  syncStatus?: { isOnline: boolean; pendingCount: number };
  accentColor?: "emerald" | "orange" | "amber" | "indigo" | "blue";
}
export function DashboardTabBar({
  title = "Navigation Tableau de Bord",
  tabs,
  activeTab,
  onSelectTab,
  syncStatus,
  accentColor = "emerald"
}: DashboardTabBarProps) {
  const [navLayoutMode, setNavLayoutMode] = useState<"tabbed" | "sidebar">("tabbed");
  const getActiveStyles = () => {
    switch (accentColor) {
      case "orange":
        return "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md font-bold scale-[1.01] border-orange-600";
      case "amber":
        return "bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md font-bold scale-[1.01] border-amber-600";
      case "indigo":
        return "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md font-bold scale-[1.01] border-indigo-600";
      case "blue":
        return "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md font-bold scale-[1.01] border-blue-600";
      default:
        return "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md font-bold scale-[1.01] border-emerald-600";
    }
  };
  const getIconInactiveColor = () => {
    switch (accentColor) {
      case "orange": return "text-orange-600 dark:text-orange-400";
      case "amber": return "text-amber-600 dark:text-amber-400";
      case "indigo": return "text-indigo-600 dark:text-indigo-400";
      case "blue": return "text-blue-600 dark:text-blue-400";
      default: return "text-emerald-600 dark:text-emerald-400";
    }
  };
  const activeTabItem = tabs.find(t => t.id === activeTab) || tabs[0];
  return (
    <div className="sticky top-2 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-md space-y-3 transition-all duration-200">
      {/* Header with Title, Active Tab Badge, Layout Switcher and Sync Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-150 dark:border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
            accentColor === "orange" ? "bg-orange-500" : accentColor === "amber" ? "bg-amber-500" : "bg-emerald-500"
          }`} />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {title}
          </h3>
          {activeTabItem && (
            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Menu: <strong className="font-extrabold">{activeTabItem.label}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Layout Mode Toggle: Tabbed Horizontal vs Sidebar Panel */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl text-[11px] font-semibold border border-zinc-200 dark:border-zinc-750">
            <button
              onClick={() => setNavLayoutMode("tabbed")}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                navLayoutMode === "tabbed"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs font-bold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Barre d'onglets horizontale"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Onglets</span>
            </button>
            <button
              onClick={() => setNavLayoutMode("sidebar")}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                navLayoutMode === "sidebar"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs font-bold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
              title="Grille / Sidebar complète"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grille Sidebar</span>
            </button>
          </div>
          {syncStatus && (
            <SyncStatusIndicator isOnline={syncStatus.isOnline} pendingCount={syncStatus.pendingCount} />
          )}
        </div>
      </div>
      {/* Tabs rendering - NO text truncation, full length visibility */}
      {navLayoutMode === "tabbed" ? (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2.5 transition-all duration-150 cursor-pointer border whitespace-nowrap min-w-max shrink-0 ${
                  isActive
                    ? getActiveStyles()
                    : "bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/90 dark:hover:bg-zinc-750 hover:text-zinc-900 dark:hover:text-white border-zinc-200/80 dark:border-zinc-700/80"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : getIconInactiveColor()}`} />
                <span className="whitespace-nowrap font-bold">{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null && tab.badge !== 0 && (
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full shrink-0 ${
                    isActive
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : tab.highlight
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-emerald-600 text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`w-full px-4 py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer border shadow-2xs ${
                  isActive
                    ? getActiveStyles()
                    : "bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-750"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-white" : getIconInactiveColor()}`} />
                  <span className="whitespace-nowrap font-bold text-left">{tab.label}</span>
                </div>
                {tab.badge !== undefined && tab.badge !== null && tab.badge !== 0 && (
                  <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full shrink-0 ${
                    isActive
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : tab.highlight
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-emerald-600 text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ----------------------------------------------------------------------
// PDF Invoice Export Helper
// ----------------------------------------------------------------------
export function handleDownloadOrderPDF(order: Order, productsList: Product[]) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Facture Commande #${order.id}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111; background: #fff; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 22px; font-weight: bold; color: #10b981; text-transform: uppercase; }
            .meta { font-size: 13px; color: #555; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; font-size: 12px; }
            th { background-color: #f9fafb; font-weight: bold; color: #374151; text-transform: uppercase; }
            .total-box { margin-top: 30px; text-align: right; font-size: 18px; font-weight: bold; color: #111; }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">FACTURE COMMANDE OFFICIELLE</div>
              <div class="meta" style="margin-top: 8px;">
                <b>Référence:</b> #${order.id}<br/>
                <b>Date:</b> ${new Date(order.createdAt).toLocaleString('fr-FR')}
              </div>
            </div>
            <div class="meta" style="text-align: right;">
              <b>Statut:</b> <span style="color: #10b981; font-weight: bold;">${order.status}</span><br/>
              <b>Paiement:</b> ${order.paymentMethod || 'CASH'}<br/>
              <b>Adresse:</b> ${order.deliveryAddress || 'Standard'}
            </div>
          </div>
          <h3 style="font-size: 14px; text-transform: uppercase; color: #374151; margin-bottom: 10px;">Détails de la commande</h3>
          <table>
            <thead>
              <tr>
                <th>Produit / Article</th>
                <th>Quantité</th>
                <th>Prix Unitaire</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items && order.items.length > 0 ? order.items.map(item => {
                const prod = productsList.find(p => p.id === item.productId);
                const name = prod ? prod.name : item.productId;
                const unitPrice = item.priceAtOrder || prod?.prixGros || prod?.prixDetail || 1000;
                return `
                  <tr>
                    <td><b>${name}</b></td>
                    <td>${item.quantity}</td>
                    <td>${unitPrice.toLocaleString()} FCFA</td>
                    <td style="text-align: right;"><b>${(item.quantity * unitPrice).toLocaleString()} FCFA</b></td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="4">Commande globale B2B / B2C</td>
                </tr>
              `}
            </tbody>
          </table>
          <div class="total-box">
            Montant Total : <span style="color: #10b981;">${order.totalAmount.toLocaleString()} FCFA</span>
          </div>
          <div class="footer">
            Facture électronique certifiée • Plateforme SupplyChain B2B & B2C
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}
const PREDEFINED_CATEGORIES = [
  "Alimentation",
  "Boissons",
  "Électronique",
  "Quincaillerie",
  "Cosmétiques",
  "Hygiène & Entretien",
  "Vêtements & Mode",
  "Pharmacie / Santé",
  "Matériaux de construction",
  "Pièces de rechange",
  "Divers"
];
// ----------------------------------------------------------------------
// Shared Price History Chart (30 Days - Purchase & Selling Prices)
// ----------------------------------------------------------------------
export { PriceHistoryChart } from "./PriceHistoryChart";
// ----------------------------------------------------------------------
// 1. ADMIN DASHBOARD
// ----------------------------------------------------------------------
interface AdminDashboardProps {
  currentUser: UserProfile;
  users: UserProfile[];
  orders: Order[];
  products: Product[];
  inventory?: InventoryItem[];
  stockMovements?: StockMovement[];
  onToggleUserStatus: (userId: string) => void;
  onDeleteUser?: (userId: string) => void;
  onUpdateCommission: (rate: number) => void;
  commissionRate: number;
  onChangeUserRole?: (userId: string, newRole: UserRole) => void;
  onUpdateUser?: (userId: string, fields: Partial<UserProfile>) => void;
  onUpdateOrderStatus?: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
}
export function AdminDashboard({
  currentUser,
  users,
  orders,
  products,
  inventory = [],
  stockMovements = [],
  onToggleUserStatus,
  onDeleteUser,
  onUpdateCommission,
  commissionRate,
  onChangeUserRole,
  onUpdateUser,
  onUpdateOrderStatus = () => {}
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"users" | "config" | "approvals">("users");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newRate, setNewRate] = useState(commissionRate.toString());
  const [userPage, setUserPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const usersPerPage = 10;
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.phone && u.phone.includes(searchQuery)) ||
    (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const paginatedUsers = filteredUsers.slice((userPage - 1) * usersPerPage, userPage * usersPerPage);
  const stats = {
    m: users.filter((u) => u.role === UserRole.MANUFACTURER).length,
    w: users.filter((u) => u.role === UserRole.WHOLESALER).length,
    sg: users.filter((u) => u.role === UserRole.SEMI_WHOLESALER).length,
    r: users.filter((u) => u.role === UserRole.RETAILER).length,
    d: users.filter((u) =>
      [UserRole.DRIVER_M2W, UserRole.DRIVER_W2R, UserRole.DRIVER_R2C, UserRole.DRIVER_W2SG, UserRole.DRIVER_SG2R].includes(u.role)
    ).length,
    c: users.filter((u) => u.role === UserRole.CLIENT).length,
    revenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
  };
  const pendingApprovals = users.filter((u) => u.status === "PENDING");
  return (
    <div className="space-y-6" id="admin-dashboard">
      {/* Claims Summary Widget for Admin oversight */}
      <ClaimsSummaryWidget orders={orders} users={users}
             currentUser={currentUser} onUpdateOrderStatus={onUpdateOrderStatus} />
      {/* Real-time stats row */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {[
          { label: "Fabricants", count: stats.m, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" },
          { label: "Grossistes", count: stats.w, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20" },
          { label: "Demi-Grossistes", count: stats.sg, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/20" },
          { label: "Détaillants", count: stats.r, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20" },
          { label: "Livreurs", count: stats.d, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20" },
          { label: "Clients", count: stats.c, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/20" },
          { label: "Volume total", count: orders.length, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/20" },
        ].map((stat, i) => (
          <div key={i} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-xl">
            <p className="text-[10px] text-zinc-500 font-medium">{stat.label}</p>
            <p className={`text-lg font-bold mt-1 ${stat.color.split(" ")[0]}`}>{stat.count}</p>
          </div>
        ))}
      </div>
      {/* Admin Tabs */}
      <DashboardTabBar
        title="Administration Système - Module de Contrôle"
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as any)}
        accentColor="emerald"
        tabs={[
          { id: "users", label: "Comptes Utilisateurs", icon: Users, badge: users.length },
          { id: "approvals", label: "Approbations", icon: UserCheck, badge: pendingApprovals.length > 0 ? pendingApprovals.length : undefined, highlight: pendingApprovals.length > 0 },
          { id: "stats", label: "Tendances & Périssabilité (30j)", icon: BarChart },
          { id: "config", label: "Commissions & Frais", icon: Settings },
        ]}
      />
      {editingUser && (
        <AdminUserEditModal
          user={editingUser}
          orders={orders}
          products={products}
          onClose={() => setEditingUser(null)}
          onSave={(userId, updates) => {
            if (onUpdateUser) onUpdateUser(userId, updates);
            setEditingUser(null);
          }}
          onDeleteUser={onDeleteUser}
        />
      )}
      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {activeTab === "users" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Base des Comptes de Distribution</h4>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Rechercher (nom, email...)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setUserPage(1);
                }}
                className="w-48 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-zinc-500 font-mono">Total : {filteredUsers.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Géolocalisation</th>
                  <th className="px-4 py-3 text-right">Solde</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-zinc-700 dark:text-zinc-300">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <img loading="lazy" src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-zinc-950 dark:text-white">{u.companyName || u.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{u.email}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{u.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {onChangeUserRole ? (
                        <select
                          value={u.role}
                          onChange={(e) => onChangeUserRole(u.id, e.target.value as UserRole)}
                          className={`text-[9px] font-bold pl-2 pr-6 py-1 rounded-md border-none focus:ring-1 focus:ring-emerald-500 cursor-pointer ${
                            u.role === UserRole.MANUFACTURER ? "bg-indigo-500/10 text-indigo-500" :
                            u.role === UserRole.WHOLESALER ? "bg-amber-500/10 text-amber-500" :
                            u.role === UserRole.RETAILER ? "bg-purple-500/10 text-purple-500" :
                            u.role === UserRole.CLIENT ? "bg-teal-500/10 text-teal-500" :
                            u.role === UserRole.ADMIN ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          <option value={UserRole.CLIENT}>CLIENT</option>
                          <option value={UserRole.RETAILER}>RETAILER</option>
                          <option value={UserRole.SEMI_WHOLESALER}>SEMI_WHOLESALER</option>
                          <option value={UserRole.WHOLESALER}>WHOLESALER</option>
                          <option value={UserRole.MANUFACTURER}>MANUFACTURER</option>
                          <option value={UserRole.ADMIN}>ADMIN</option>
                          <option value={UserRole.DRIVER_R2C}>DRIVER_R2C</option>
                          <option value={UserRole.DRIVER_W2R}>DRIVER_W2R</option>
                          <option value={UserRole.DRIVER_W2SG}>DRIVER_W2SG</option>
                          <option value={UserRole.DRIVER_SG2R}>DRIVER_SG2R</option>
                        </select>
                      ) : (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                          u.role === UserRole.MANUFACTURER ? "bg-indigo-500/10 text-indigo-500" :
                          u.role === UserRole.WHOLESALER ? "bg-amber-500/10 text-amber-500" :
                          u.role === UserRole.RETAILER ? "bg-purple-500/10 text-purple-500" :
                          u.role === UserRole.CLIENT ? "bg-teal-500/10 text-teal-500" : "bg-blue-500/10 text-blue-500"
                        }`}>
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {u.country} - {u.region}
                    </td>
                    <td className="px-4 py-3 text-right font-bold font-mono">
                      {u.balance !== undefined ? formatCFA(u.balance) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        u.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600" :
                        u.status === "PENDING" ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-600"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => onToggleUserStatus(u.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                          u.status === "ACTIVE"
                            ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 hover:bg-rose-100"
                            : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 hover:bg-emerald-100"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Suspendre" : "Activer"}
                      </button>
                      {onDeleteUser && (
                        <>
                          <button
                            onClick={() => setEditingUser(u)}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                          >
                            Gérer
                          </button>
                          <button
                            onClick={() => onDeleteUser(u.id)}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-200 transition cursor-pointer"
                            title="Supprimer le compte"
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center p-4">
              <button 
                onClick={() => setUserPage(p => Math.max(1, p - 1))}
                disabled={userPage === 1}
                className="text-xs px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="text-xs text-zinc-500">Page {userPage}</span>
              <button 
                onClick={() => setUserPage(p => Math.min(Math.ceil(filteredUsers.length / usersPerPage), p + 1))}
                disabled={userPage >= Math.ceil(filteredUsers.length / usersPerPage)}
                className="text-xs px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === "approvals" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4">
            Demandes d'adhésion en attente de validation
          </h4>
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              Aucun nouveau compte en attente de validation général.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((p) => (
                <div key={p.id} className="p-4 border border-zinc-150 dark:border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img loading="lazy" src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="font-bold text-sm text-zinc-950 dark:text-white">{p.companyName || p.name}</p>
                      <p className="text-xs text-zinc-500">{p.role} • {p.country}, {p.region}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleUserStatus(p.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Approuver le compte
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "stats" && (
        <div className="space-y-6">
          <ExpirationAlertsBanner alerts={inventoryService.checkExpirationAlerts(inventory, products, 15)} />
          <ThirtyDaySalesAndStockChart
            orders={orders}
            inventory={inventory}
            products={products}
            stockMovements={stockMovements}
            currentUserId={currentUser.id}
          />
        </div>
      )}
      {activeTab === "config" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-md">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4">
            Paramètres Économiques de la Plateforme
          </h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateCommission(parseFloat(newRate));
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Taux de commission plateforme (%)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs text-zinc-950 dark:text-white"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
                >
                  Mettre à jour
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                Cette commission est prélevée automatiquement sur toutes les ventes de la marketplace (Fabricants et Grossistes).
              </p>
            </div>
          </form>
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
// ----------------------------------------------------------------------
// 2. MANUFACTURER DASHBOARD
// ----------------------------------------------------------------------
interface ManufacturerDashboardProps {
  currentUser: UserProfile;
  products: Product[];
  inventory: InventoryItem[];
  orders: Order[];
  users: UserProfile[];
  lightClients: LightClient[];
  payments: DebtPayment[];
  connections?: Connection[];
  syncQueue: any[];
  isOnline: boolean;
  stockMovements?: StockMovement[];
  onCreateProduct: (p: Omit<Product, "id" | "creatorId">, initialStock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, threshold?: number, expirationDate?: string) => void;
  onUpdateInventory: (itemId: string, stock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, productId?: string) => void;
  onDeleteInventoryItem: (itemId: string, productId?: string, skipConfirm?: boolean) => void;
  onPlaceSale: (clientId: string | "CASH_CLIENT", items: { productId: string; quantity: number }[], amountPaid: number, paymentMethod: Order["paymentMethod"]) => void;
  onCreateLightClient: (identifier: string, notes?: string, role?: any, isPartnerRegistration?: boolean) => void;
  onAddPayment: (clientId: string, amount: number) => void;
  onDeleteLightClient: (clientId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
  onUpdateProductFull?: (productId: string, productData: Partial<Product>, inventoryItemId?: string, inventoryData?: Partial<InventoryItem>) => void;
}
export function ManufacturerDashboard({
  currentUser,
  products,
  inventory,
  orders,
  users,
  lightClients,
  payments,
  connections = [],
  syncQueue,
  isOnline,
  stockMovements = [],
  onCreateProduct,
  onUpdateInventory,
  onDeleteInventoryItem,
  onPlaceSale,
  onCreateLightClient,
  onAddPayment,
  onDeleteLightClient,
  onUpdateOrderStatus,
  onUpdateProductFull,
}: ManufacturerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"catalog" | "orders" | "sales" | "ai" | "buyers" | "clients" | "sync" | "reviews">("catalog");
  const [isAdding, setIsAdding] = useState(false);
  const [posCart, setPosCart] = useState<Record<string, number>>({});
  const [posSelectedLightClientId, setPosSelectedLightClientId] = useState<string>("");
  const [posAmountPaid, setPosAmountPaid] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mfgCategory, setMfgCategory] = useState("Alimentation");
  const [isCustomMfgCategory, setIsCustomMfgCategory] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("file");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProductForChart, setSelectedProductForChart] = useState<string | null>(null);
  const [stockSort, setStockSort] = useState<"none" | "asc" | "desc">("none");
  const [editingModalItem, setEditingModalItem] = useState<{ product: Product; inventoryItem: InventoryItem } | null>(null);
  useEffect(() => {
    if (!isAdding) {
      setUploadedImage("");
      setUploadMode("file");
    }
  }, [isAdding]);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };
  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && event.target.result) {
        setUploadedImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };
  // Filter products created by this manufacturer
  const myProducts = products.filter((p) => p.creatorId === currentUser.id);
  const myInventory = useMemo(() => {
    return inventory.filter((i) => i.ownerId === currentUser.id || i.ownerId === currentUser.email);
  }, [inventory, currentUser]);
  // Incoming Wholesaler Orders
  const myOrders = orders.filter((o) => o.receiverId === currentUser.id);
  // Unique Buyers
  const myBuyers = useMemo(() => {
    const buyerIds = new Set<string>();
    orders
      .filter(order => order.receiverId === currentUser.id)
      .forEach(order => {
        if (order.senderId && order.senderId !== currentUser.id) {
          buyerIds.add(order.senderId);
        }
      });
    lightClients
      .filter(lc => lc.ownerId === currentUser.id && lc.linkedUserId)
      .forEach(lc => {
        buyerIds.add(lc.linkedUserId!);
      });
    return Array.from(buyerIds)
      .map(id => users.find(u => u.id === id))
      .filter((u): u is UserProfile => !!u && u.role === UserRole.WHOLESALER);
  }, [orders, lightClients, users, currentUser.id]);
  const handlePOSAddToCart = (prodId: string, qty: number) => {
    setPosCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handleCheckoutPOS = async (saleData: any) => {
    try {
      const items = saleData.lignes.map((l: any) => ({ productId: l.produitId, quantity: l.quantite }));
      onPlaceSale(saleData.acheteurId || "CASH_CLIENT", items, posAmountPaid, "CASH");
      setPosCart({});
      setPosAmountPaid(0);
      setPosSelectedLightClientId("");
    } catch (e: any) {
      throw new Error("Erreur de transaction : " + e.message);
    }
  };
  // Available M2W drivers
  const m2wDrivers = users.filter((u) => u.role === UserRole.DRIVER_M2W && u.status === "ACTIVE");
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const manufacturerExpirationAlerts = useMemo(() => {
    return inventoryService.checkExpirationAlerts(inventory, products, 15).filter(a => a.ownerId === currentUser.id || currentUser.role === UserRole.ADMIN);
  }, [inventory, products, currentUser]);
  return (
    <div className="space-y-6" id="manufacturer-dashboard">
      <DashboardTabBar
        title="Menu Fabricant - Operations & Catalogue"
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as any)}
        syncStatus={{ isOnline, pendingCount: syncQueue.length }}
        accentColor="emerald"
        tabs={[
          { id: "catalog", label: "Catalogue & Stocks", icon: Layers },
          { id: "orders", label: "Commandes B2B", icon: ShoppingCart },
          { id: "sales", label: "Vente Comptoir", icon: ShoppingBag },
          { id: "ai", label: "Prévisions IA", icon: Sparkles },
          { id: "clients", label: "Clients & Adresses", icon: BookOpen },
          { id: "reviews", label: "Avis Partenaires", icon: MessageSquare },
          { id: "sync", label: "Sync", icon: Cloud, badge: syncQueue.length > 0 ? syncQueue.length : undefined },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {activeTab === "buyers" && (
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Mes Acheteurs ({myBuyers.length})</h4>
          {myBuyers.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">Aucun acheteur enregistré pour le moment.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myBuyers.map(buyer => (
                <div key={buyer.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
                    {buyer.companyName ? buyer.companyName[0] : buyer.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{buyer.companyName || buyer.name}</p>
                    <p className="text-xs text-zinc-500">{buyer.role}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mt-8">Stocks de mes Acheteurs</h4>
          {myBuyers.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">Aucun acheteur enregistré pour le moment.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myBuyers.map(buyer => {
                const buyerInventory = inventory.filter(i => i.ownerId === buyer.id);
                return (
                  <div key={buyer.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl">
                    <p className="font-semibold text-sm mb-2">{buyer.companyName || buyer.name}</p>
                    {buyerInventory.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">Aucun stock disponible.</p>
                    ) : (
                      <div className="space-y-2">
                        {buyerInventory.map(item => {
                          const product = products.find(p => p.id === item.productId);
                          return (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span>{product?.name || 'Produit inconnu'}</span>
                              <span className="font-bold">{item.stock}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <ExpirationAlertsBanner alerts={manufacturerExpirationAlerts} />
          <ThirtyDaySalesAndStockChart
            orders={orders}
            inventory={inventory}
            products={products}
            stockMovements={stockMovements}
            currentUserId={currentUser.id}
          />
          <LowStockAlerts inventory={inventory} products={products}
             currentUserId={currentUser.id} />
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Mon Catalogue d'Usine</h4>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {isAdding ? "Fermer" : "Nouveau Produit"}
            </button>
          </div>
          {isAdding && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                // Determine the image link/base64 to use
                let finalImage = "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300";
                if (uploadMode === "file") {
                  if (uploadedImage) {
                    finalImage = uploadedImage;
                  }
                } else {
                  const urlImg = fd.get("image") as string;
                  if (urlImg) {
                    finalImage = urlImg;
                  } else if (uploadedImage && uploadedImage.startsWith("http")) {
                    finalImage = uploadedImage;
                  }
                }
                const p = {
                  name: fd.get("name") as string,
                  description: fd.get("description") as string,
                  category: fd.get("category") as string,
                  brand: fd.get("brand") as string,
                  unit: fd.get("unit") as string,
                  weight: parseFloat(fd.get("weight") as string),
                  volume: parseFloat(fd.get("volume") as string),
                  image: finalImage, imageUrl: uploadMode === "url" ? (fd.get("image") as string || undefined) : undefined,
                  barcode: Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
                  qrCode: `QR_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                };
                const basePrice = parseFloat(fd.get("price") as string) || 0;
                const prixGrosVal = parseFloat(fd.get("prixGros") as string) || basePrice;
                const prixDetailVal = parseFloat(fd.get("prixDetail") as string) || basePrice;
                const moqVal = parseInt(fd.get("quantiteMinimum") as string) || 1;
                onCreateProduct(
                  p,
                  parseInt(fd.get("stock") as string) || 0,
                  basePrice,
                  prixGrosVal,
                  prixDetailVal,
                  moqVal
                );
                setIsAdding(false);
              }}
              className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Nom du produit</label>
                  <input required name="name" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                </div>
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                  <textarea required name="description" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl h-20" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold">Catégorie</label>
                    {!isCustomMfgCategory ? (
                      <div className="relative">
                        <select
                          value={PREDEFINED_CATEGORIES.includes(mfgCategory) ? mfgCategory : "AUTRE"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "AUTRE") {
                              setIsCustomMfgCategory(true);
                              setMfgCategory("");
                            } else {
                              setMfgCategory(val);
                            }
                          }}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white appearance-none pr-8 cursor-pointer font-medium text-xs"
                        >
                          {PREDEFINED_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="AUTRE">➕ Autre (saisir manuellement)...</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-[9px]">
                          ▼
                        </div>
                        <input type="hidden" name="category" value={mfgCategory} />
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          required
                          autoFocus
                          value={mfgCategory}
                          onChange={(e) => setMfgCategory(e.target.value)}
                          placeholder="Saisir la catégorie..."
                          className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium text-xs"
                          name="category"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomMfgCategory(false);
                            setMfgCategory("Alimentation");
                          }}
                          className="px-2.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold transition text-[10px]"
                        >
                          Retour
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Marque</label>
                    <input required name="brand" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Unité B2B</label>
                    <input required name="unit" placeholder="Carton de 24" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Poids (kg)</label>
                    <input required type="number" step="0.1" name="weight" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Vol (m³)</label>
                    <input required type="number" step="0.01" name="volume" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Illustration du Produit</label>
                  <div className="flex gap-2 p-1 bg-zinc-150 dark:bg-zinc-800 rounded-lg text-[10px] font-bold mb-2">
                    <button
                      type="button"
                      onClick={() => setUploadMode("file")}
                      className={`flex-1 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1 ${uploadMode === "file" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-850"}`}
                    >
                      <Upload className="w-3.5 h-3.5" /> Uploader un fichier
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("url")}
                      className={`flex-1 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1 ${uploadMode === "url" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-850"}`}
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Lien URL
                    </button>
                  </div>
                  {uploadMode === "file" ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition duration-200 flex flex-col items-center justify-center min-h-[110px] ${
                        isDragging
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
                          : "border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 bg-white dark:bg-zinc-800/50"
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      {uploadedImage && !uploadedImage.startsWith("http") ? (
                        <div className="space-y-2 w-full flex flex-col items-center">
                          <img loading="lazy" src={uploadedImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg shadow-xs border border-zinc-200 dark:border-zinc-700" />
                          <span className="text-[10px] text-zinc-500 font-medium">Image chargée avec succès. Cliquez pour changer.</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Upload className="w-6 h-6 text-zinc-400 mx-auto" />
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-normal">
                            Glissez-déposez une image, ou <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline">parcourez</span>
                          </p>
                          <p className="text-[9px] text-zinc-400">PNG, JPG, WEBP jusqu'à 5 Mo</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="url"
                        name="image"
                        placeholder="https://images.unsplash.com/photo-..."
                        defaultValue={uploadedImage && uploadedImage.startsWith("http") ? uploadedImage : ""}
                        onChange={(e) => setUploadedImage(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs"
                      />
                      {uploadedImage && uploadedImage.startsWith("http") && (
                        <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                          <img loading="lazy" src={uploadedImage} alt="Preview" className="h-8 w-8 object-cover rounded-md border border-zinc-200 dark:border-zinc-700" />
                          <span className="text-[9px] text-zinc-500 truncate">Aperçu du lien URL</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Stock Initial</label>
                    <input required type="number" name="stock" defaultValue="50" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-emerald-700 dark:text-emerald-400 font-bold mb-1">Prix Gros B2B (FCFA)</label>
                    <input required type="number" name="prixGros" placeholder="Ex: 5000" className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl font-bold font-mono" />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Quantité Min B2B</label>
                    <input required type="number" name="quantiteMinimum" defaultValue="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-amber-700 dark:text-amber-400 font-bold mb-1">Prix Détail (FCFA)</label>
                    <input required type="number" name="prixDetail" placeholder="Ex: 7500" className="w-full px-3 py-2 border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl font-bold font-mono" />
                  </div>
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-bold transition">
                    Créer et Injecter au Catalogue
                  </button>
                </div>
              </div>
            </form>
          )}
          <StockCategoryOrganizer
            inventory={inventory}
            products={products}
            currentUserId={currentUser.id}
            onUpdateInventory={onUpdateInventory}
            onDeleteInventoryItem={onDeleteInventoryItem}
            onEditProduct={(product, inventoryItem) => setEditingModalItem({ product, inventoryItem })}
            onOpenAddModal={() => setIsAdding(true)}
            onExportCSV={() => handleExportInventoryCSV(inventory, products, currentUser.id)}
            title="Catalogue Usine & Marchandises par Catégorie"
            role={currentUser.role}
          />
        </div>
      )}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <ClaimsSummaryWidget orders={orders} users={users}
             currentUser={currentUser} onUpdateOrderStatus={onUpdateOrderStatus} />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Commandes des Grossistes B2B</h4>
            <SalesExportButton
              orders={myOrders}
              products={products}
              users={users}
              currentUserId={currentUser.id}
            />
          </div>
          {myOrders.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">Aucune commande reçue pour l'instant.</div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((order) => {
                const client = users.find((u) => u.id === order.senderId);
                return (
                  <div key={order.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold font-mono uppercase">
                          {order.id}
                        </span>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 mt-1">
                          Par : {client?.companyName || client?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.status === OrderStatus.PENDING ? "bg-amber-100 text-amber-700" :
                            order.status === OrderStatus.CONFIRMED ? "bg-blue-100 text-blue-700" :
                            order.status === OrderStatus.PREPARING ? "bg-purple-100 text-purple-700" :
                            order.status === OrderStatus.READY ? "bg-teal-100 text-teal-700" :
                            order.status === OrderStatus.DELIVERED ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {order.status}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}>
                            Paiement : {order.paymentStatus === "PAID" ? "PAYÉ" : "NON PAYÉ"}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-1">
                          {formatCFA(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                    {/* Order items summary */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-850 text-[11px] space-y-1">
                      {order.items.map((item, idx) => {
                        const prod = products.find((p) => p.id === item.productId);
                        return (
                          <div key={item.productId + '_' + idx} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                            <span>{prod?.name} ({prod?.unit})</span>
                            <span className="font-mono">Qty: {item.quantity} x {formatCFA(item.priceAtOrder)}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Order actions workflow */}
                    <div className="flex gap-2 justify-end">
                      {order.status === OrderStatus.PENDING && (
                        <button
                          onClick={() => onUpdateOrderStatus(order.id, OrderStatus.CONFIRMED)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold"
                        >
                          Confirmer la commande
                        </button>
                      )}
                      {order.status === OrderStatus.CONFIRMED && (
                        <button
                          onClick={() => onUpdateOrderStatus(order.id, OrderStatus.PREPARING)}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold"
                        >
                          Lancer la préparation
                        </button>
                      )}
                      {order.status === OrderStatus.PREPARING && (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedDriver}
                            onChange={(e) => setSelectedDriver(e.target.value)}
                            className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-850"
                          >
                            <option value="">Sélectionner un livreur usine...</option>
                            {m2wDrivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.rating}★)
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              if (!selectedDriver) {
                                alert("Veuillez d'abord sélectionner un chauffeur.");
                                return;
                              }
                              onUpdateOrderStatus(order.id, OrderStatus.SHIPPED, selectedDriver);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Truck className="w-4 h-4" /> Valider le départ livraison
                          </button>
                        </div>
                      )}
                      {order.status === OrderStatus.SHIPPED && (
                        <span className="text-xs text-zinc-500 italic">En route pour livraison B2B...</span>
                      )}
                    </div>
                    <div className="pt-2">
                      <OrderClaimAndConfirm
                        orderId={order.id}
                        status={order.status}
                        onConfirmReceipt={() => onUpdateOrderStatus(order.id, OrderStatus.DELIVERED)}
                        order={order}
                        products={products}
                        users={users}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeTab === "sales" && (
        <div className="space-y-6">
          <POSComponent
            currentUser={currentUser}
            inventory={myInventory}
            products={products}
            lightClients={lightClients}
            posCart={posCart}
            onAddToCart={handlePOSAddToCart}
            onCheckout={handleCheckoutPOS}
            selectedClientId={posSelectedLightClientId}
            setSelectedClientId={setPosSelectedLightClientId}
            amountPaid={posAmountPaid}
            setAmountPaid={setPosAmountPaid}
            title="Vente Comptoir Usine"
          />
        </div>
      )}
      {activeTab === "clients" && (
        <div className="animate-fade-in">
          <ClientManagement 
            clients={lightClients}
            orders={orders}
            payments={payments}
            onCreateClient={onCreateLightClient}
            onDeleteClient={onDeleteLightClient}
            onAddPayment={onAddPayment}
            currentUserRole={currentUser.role}
            currentUser={currentUser}
            users={users}
            products={products}
            inventory={inventory}
          />
        </div>
      )}
      {activeTab === "sync" && (
        <div className="animate-fade-in">
          <SyncHistory queue={syncQueue} />
        </div>
      )}
      {activeTab === "reviews" && (
        <div className="animate-fade-in">
          <PartnerReviewsSection
            connections={connections}
            currentUser={currentUser}
            users={users}
          />
        </div>
      )}
      {activeTab === "ai" && (
        <div className="animate-fade-in">
          <StockForecastModule
            products={products}
            orders={orders}
            currentUser={currentUser}
          />
        </div>
      )}
        </motion.div>
      </AnimatePresence>
      <CreateProductModal
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        defaultBrand={currentUser.companyName || currentUser.name}
        onSubmit={(productData, stock, price, prixGros, prixDetail, quantiteMinimum, threshold, expirationDate) => {
          onCreateProduct(productData, stock, price, prixGros, prixDetail, quantiteMinimum, threshold, expirationDate);
          setIsAdding(false);
        }}
      />
      <EditProductStockModal
        isOpen={!!editingModalItem}
        onClose={() => setEditingModalItem(null)}
        product={editingModalItem?.product || null}
        inventoryItem={editingModalItem?.inventoryItem || null}
        onDelete={(itemId, productId) => {
          onDeleteInventoryItem(itemId, productId, true);
          setEditingModalItem(null);
        }}
        onSave={(productId, productData, inventoryItemId, inventoryData) => {
          if (onUpdateProductFull) {
            onUpdateProductFull(productId, productData, inventoryItemId, inventoryData);
          } else {
            onUpdateInventory(
              inventoryItemId || "",
              inventoryData?.stock || 0,
              inventoryData?.price || 0,
              inventoryData?.prixGros,
              inventoryData?.prixDetail,
              inventoryData?.quantiteMinimum,
              productId
            );
          }
          setEditingModalItem(null);
        }}
      />
    </div>
  );
}
// ----------------------------------------------------------------------
// 3. WHOLESALER DASHBOARD
// ----------------------------------------------------------------------
interface WholesalerDashboardProps {
  currentUser: UserProfile;
  products: Product[];
  inventory: InventoryItem[];
  orders: Order[];
  users: UserProfile[];
  lightClients: LightClient[];
  payments: DebtPayment[];
  connections?: Connection[];
  syncQueue: any[];
  isOnline: boolean;
  stockMovements?: StockMovement[];
  onPlaceB2BOrder: (receiverId: string, items: { productId: string; quantity: number }[]) => void;
  onUpdateInventory: (itemId: string, stock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, productId?: string) => void;
  onDeleteInventoryItem: (itemId: string, productId?: string, skipConfirm?: boolean) => void;
  onCreateProduct?: (p: Omit<Product, "id" | "creatorId">, initialStock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, threshold?: number, expirationDate?: string) => void;
  onPlaceSale: (clientId: string | "CASH_CLIENT", items: { productId: string; quantity: number }[], amountPaid: number, paymentMethod: Order["paymentMethod"]) => void;
  onCreateLightClient: (identifier: string, notes?: string, role?: any, isPartnerRegistration?: boolean) => void;
  onAddPayment: (clientId: string, amount: number) => void;
  onDeleteLightClient: (clientId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
  onPayOrder?: (orderId: string) => void;
  onUpdateCreditLimit?: (id: string, isRealUser: boolean, limit: number) => void;
  onUpdateProductFull?: (productId: string, productData: Partial<Product>, inventoryItemId?: string, inventoryData?: Partial<InventoryItem>) => void;
  favoriteProductIds?: string[];
  onSelectProduct?: (product: Product, inventoryItem?: InventoryItem) => void;
}
export function WholesalerDashboard({
  currentUser,
  products,
  inventory,
  orders,
  users,
  lightClients,
  payments,
  connections = [],
  syncQueue,
  isOnline,
  stockMovements = [],
  onPlaceB2BOrder,
  onUpdateInventory,
  onDeleteInventoryItem,
  onCreateProduct,
  onPlaceSale,
  onCreateLightClient,
  onAddPayment,
  onDeleteLightClient,
  onUpdateOrderStatus,
  onPayOrder,
  onUpdateCreditLimit,
  onUpdateProductFull,
  favoriteProductIds = [],
  onSelectProduct,
}: WholesalerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"sales_dashboard" | "dashboard" | "forecast" | "procure" | "purchases" | "sales" | "inventory" | "alerts" | "accounting" | "buyers" | "clients" | "sync" | "reviews">("sales_dashboard");
  const handleDiagnoseDelivery = async (order: Order) => {
    import("../services/connectionService").then(async ({ connectionService }) => {
      const diag = await connectionService.validateRelationshipActive(order.senderId, order.receiverId);
      if (diag.isActive) {
        alert("Diagnostic ✅ : Le partenariat B2B est correctement configuré et actif. La livraison peut s'effectuer normalement.");
      } else {
        if (confirm(`Diagnostic ⚠️ : Problème de partenariat détecté (${diag.statut}). Voulez-vous réparer automatiquement cette connexion pour autoriser la livraison ?`)) {
          let connectionId = diag.relationId;
          if (!connectionId) {
             const senderObj = users.find(u => u.id === order.senderId);
             if (senderObj) {
                 const req = await connectionService.envoyerDemandeConnexion(currentUser, senderObj, "Auto-diagnostic");
                 connectionId = req.relationId;
             }
          }
          if (connectionId) {
              await connectionService.acceptConnection(connectionId, currentUser.id);
              alert("Réparation effectuée avec succès ! Le partenariat est maintenant actif.");
          } else {
              alert("Impossible de réparer automatiquement : le compte acheteur est introuvable.");
          }
        }
      }
    });
  };
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [procureCart, setProcureCart] = useState<Record<string, number>>({});
  const [posCart, setPosCart] = useState<Record<string, number>>({});
  const [posSelectedLightClientId, setPosSelectedLightClientId] = useState<string>("");
  const [posAmountPaid, setPosAmountPaid] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingStockModalOpen, setIsAddingStockModalOpen] = useState(false);
  const [editingModalItem, setEditingModalItem] = useState<{ product: Product; inventoryItem: InventoryItem } | null>(null);
  const [selectedProdToAdd, setSelectedProdToAdd] = useState<string>("");
  const [quantityToAdd, setQuantityToAdd] = useState<string>("50");
  const [priceToAdd, setPriceToAdd] = useState<string>("15000");
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Alimentaire");
  const [isCustomWholesaleCategory, setIsCustomWholesaleCategory] = useState(false);
  const [newProdUnit, setNewProdUnit] = useState("Carton");
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [uploadedImage, setUploadedImage] = useState("");
  const [imageLinkInput, setImageLinkInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stockSort, setStockSort] = useState<"none" | "asc" | "desc">("none");
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };
  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && event.target.result) {
        setUploadedImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };
  // Filter manufacturers (all active manufacturers on the platform)
  const manufacturers = useMemo(() => {
    return users.filter(u => {
      const uStatus = ((u.status || (u as any).statut || "") as string).toLowerCase();
      return (
        u.role === UserRole.MANUFACTURER && 
        (uStatus === "active" || uStatus === "actif" || !u.status)
      );
    });
  }, [users]);
  // Wholesaler inventories
  const myInventory = useMemo(() => {
    return inventory.filter((i) => i.ownerId === currentUser.id || i.ownerId === currentUser.email);
  }, [inventory, currentUser]);
  // Incoming B2B orders
  const incomingRetailerOrders = orders.filter((o) => o.receiverId === currentUser.id && o.orderType.startsWith("B2B"));
  // Unique Buyers
  const myBuyers = useMemo(() => {
    const buyerIds = new Set<string>();
    orders
      .filter(order => order.receiverId === currentUser.id)
      .forEach(order => {
        if (order.senderId && order.senderId !== currentUser.id) {
          buyerIds.add(order.senderId);
        }
      });
    lightClients
      .filter(lc => lc.ownerId === currentUser.id && lc.linkedUserId)
      .forEach(lc => {
        buyerIds.add(lc.linkedUserId!);
      });
    return Array.from(buyerIds)
      .map(id => users.find(u => u.id === id))
      .filter((u): u is UserProfile => !!u && [UserRole.SEMI_WHOLESALER, UserRole.RETAILER].includes(u.role));
  }, [orders, lightClients, users, currentUser.id]);
  // Outgoing B2B orders
  const myB2BOrders = orders.filter((o) => o.senderId === currentUser.id && o.orderType.startsWith("B2B"));
  // Available drivers level 2 (W2R)
  const w2rDrivers = users.filter((u) => u.role === UserRole.DRIVER_W2R && u.status === "ACTIVE");
  // Available drivers from Wholesaler to Semi-Wholesaler (W2SG)
  const w2sgDrivers = users.filter((u) => u.role === UserRole.DRIVER_W2SG && u.status === "ACTIVE");
  // Statistics for Wholesaler
  const totalPurchasesVal = myB2BOrders
    .filter(o => o.status === OrderStatus.DELIVERED)
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const completedSales = incomingRetailerOrders.filter(o => o.status === OrderStatus.DELIVERED);
  const salesToRetailersVal = completedSales
    .filter(o => o.orderType === "B2B_W2R")
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const salesToSemiWholesalersVal = completedSales
    .filter(o => o.orderType === "B2B_W2SG")
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const totalRevenue = salesToRetailersVal + salesToSemiWholesalersVal;
  const activeAlerts = myInventory.filter(i => i.stock <= (i.threshold || 10));
  const handleAddToCart = (prodId: string, qty: number) => {
    setProcureCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handleCheckoutProcure = () => {
    if (!selectedManufacturer) {
      alert("Veuillez sélectionner un fabricant avant de passer commande.");
      return;
    }
    const items = Object.keys(procureCart)
      .filter((prodId) => procureCart[prodId] > 0)
      .map((prodId) => ({ productId: prodId, quantity: procureCart[prodId] }));
    if (items.length === 0) {
      alert("Votre panier d'approvisionnement est vide.");
      return;
    }
    onPlaceB2BOrder(selectedManufacturer, items);
    setProcureCart({});
    alert("Votre commande de gros a été passée avec succès auprès du fabricant !");
  };
  const handlePOSAddToCart = (prodId: string, qty: number) => {
    setPosCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handleCheckoutPOS = async (saleData: any) => {
    try {
      await venteService.enregistrerVenteHorsLigneDirecte({
        vendeurId: currentUser.id,
        vendeurNom: currentUser.companyName || currentUser.name,
        vendeurRole: currentUser.role,
        acheteurId: saleData.acheteurId || "CASH_CLIENT",
        acheteurNom: saleData.acheteurNom || "Client comptoir",
        typeVente: saleData.typeVente || "GROS",
        lignes: saleData.lignes || [],
        total: saleData.total || 0,
        paymentMethod: "CASH",
        amountPaid: posAmountPaid
      });
      const items = saleData.lignes.map((l: any) => ({ productId: l.produitId, quantity: l.quantite }));
      onPlaceSale(saleData.acheteurId || "CASH_CLIENT", items, posAmountPaid, "CASH");
      setPosCart({});
      setPosAmountPaid(0);
      setPosSelectedLightClientId("");
    } catch (e: any) {
      console.warn("Erreur sauvegarde Vente POS Supabase:", e);
      const items = saleData.lignes.map((l: any) => ({ productId: l.produitId, quantity: l.quantite }));
      onPlaceSale(saleData.acheteurId || "CASH_CLIENT", items, posAmountPaid, "CASH");
      setPosCart({});
      setPosAmountPaid(0);
    }
  };
  const wholesalerExpirationAlerts = useMemo(() => {
    return inventoryService.checkExpirationAlerts(inventory, products, 15).filter(a => a.ownerId === currentUser.id || currentUser.role === UserRole.ADMIN);
  }, [inventory, products, currentUser]);
  return (
    <div className="space-y-6" id="wholesaler-dashboard">
      <ClaimsSummaryWidget orders={orders} users={users}
             currentUser={currentUser} onUpdateOrderStatus={onUpdateOrderStatus} />
      <DashboardTabBar
        title="Menu Grossiste - Opérations & Dashboard de Vente"
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as any)}
        syncStatus={{ isOnline, pendingCount: syncQueue.length }}
        accentColor="emerald"
        tabs={[
          { id: "sales_dashboard", label: "Dashboard de Vente", icon: TrendingUp },
          { id: "dashboard", label: "Tableau de Bord Personnalisé", icon: LayoutGrid },
          { id: "forecast", label: "Prévisions Stock IA", icon: Sparkles },
          { id: "procure", label: "S'approvisionner", icon: Landmark },
          { id: "purchases", label: "Mes Achats", icon: ShoppingCart },
          { id: "sales", label: "Ventes & Comptoir", icon: ShoppingBag },
          { id: "inventory", label: "Stocks", icon: Layers },
          { id: "accounting", label: "Comptabilité", icon: Wallet },
          { id: "clients", label: "Clients & Adresses", icon: BookOpen },
          { id: "reviews", label: "Avis Partenaires", icon: MessageSquare },
          { id: "sync", label: "Sync", icon: Cloud, badge: syncQueue.length > 0 ? syncQueue.length : undefined },
          { id: "buyers", label: "Mes Acheteurs", icon: Users },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {activeTab === "sales_dashboard" && (
            <div className="animate-fade-in">
              <MerchantSalesDashboard
                orders={orders}
                products={products}
                currentUser={currentUser}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onPlaceSale={onPlaceSale}
              />
            </div>
          )}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
              <ExpirationAlertsBanner alerts={wholesalerExpirationAlerts} />
              <CustomizableDashboard
                currentUser={currentUser}
                products={products}
                orders={orders}
                inventory={inventory}
                users={users}
                payments={payments}
            lightClients={lightClients}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onOpenReorderModal={() => setActiveTab("procure")}
                onOpenComparator={() => {
                  if (typeof window !== "undefined") {
                    const btn = document.getElementById("header-comparator-toggle");
                    if (btn) btn.click();
                  }
                }}
              />
              {onSelectProduct && (
                <FavoritesSection
                  favoriteIds={favoriteProductIds}
                  products={products}
                  inventory={inventory}
                  onSelectProduct={onSelectProduct}
                />
              )}
            </div>
          )}
          {activeTab === "forecast" && (
            <div className="animate-fade-in">
              <StockForecastModule
                products={products}
                orders={orders}
                currentUser={currentUser}
                onOpenReorderModal={() => setActiveTab("procure")}
                onOpenComparator={() => {
                  if (typeof window !== "undefined") {
                    const btn = document.getElementById("header-comparator-toggle");
                    if (btn) btn.click();
                  }
                }}
              />
            </div>
          )}
      {activeTab === "buyers" && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-150 dark:border-zinc-800">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Mes Acheteurs & Crédits</h4>
            <p className="text-[11px] text-zinc-500 mt-1">Identifiez clairement vos acheteurs (partenaires et locaux), suivez leurs volumes d'achats cumulés et gérez leurs encours de crédit (ardoises).</p>
          </div>
          <MyBuyersModule
            connections={connections}
            currentUser={currentUser}
            users={users}
            orders={orders}
            payments={payments}
            lightClients={lightClients}
            products={products}
            onAddPayment={onAddPayment}
            onUpdateCreditLimit={onUpdateCreditLimit}
            onCreateLightClient={onCreateLightClient}
          />
        </div>
      )}
      {activeTab === "procure" && (
        <div className="space-y-4">
          <SupplierSelector
            connections={connections}
            orders={orders}
            currentUser={currentUser}
            users={users}
            lightClients={lightClients}
            selectedSupplierId={selectedManufacturer}
            onSelectSupplier={(id) => {
              setSelectedManufacturer(id);
              setProcureCart({});
            }}
            onCreateLightClient={onCreateLightClient}
            targetRoles={[UserRole.MANUFACTURER, UserRole.WHOLESALER]}
            title="S'approvisionner : Achat Direct auprès des Usines & Grossistes"
            description="Choisissez un fournisseur dans votre carnet d'adresses, vos partenaires, ou tapez son numéro de téléphone / email."
          />
          {selectedManufacturer && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">Articles d'Usine Disponibles</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {products
                    .map((prod) => {
                      const invItem = inventory.find((i) => i.productId === prod.id && i.ownerId === selectedManufacturer);
                      const stock = invItem ? invItem.stock : 999;
                      const price = invItem?.price || invItem?.prixGros || prod.prixGros || prod.prixDetail || (prod as any).price || 1000;
                      return (
                        <div key={prod.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-xl flex items-center justify-between">
                          <div className="flex gap-2 items-center min-w-0">
                            <img loading="lazy" src={prod.image} alt={prod.name} className="w-10 h-10 rounded object-cover" />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-zinc-950 dark:text-white truncate">{prod.name}</p>
                              <p className="text-[9px] text-zinc-500">{prod.unit} • Usine dispo: {stock}</p>
                              <p className="text-xs font-bold text-emerald-600 font-mono mt-0.5">{formatCFA(price)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAddToCart(prod.id, -1)}
                              disabled={!procureCart[prod.id]}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold">{procureCart[prod.id] || 0}</span>
                            <button
                              onClick={() => handleAddToCart(prod.id, 1)}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold text-emerald-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              {/* Shopping summary */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 rounded-2xl h-fit space-y-4 text-xs">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Synthèse du Panier B2B</h5>
                <div className="space-y-2">
                  {Object.keys(procureCart)
                    .filter((prodId) => procureCart[prodId] > 0)
                    .map((prodId) => {
                      const qty = procureCart[prodId];
                      const prod = products.find((p) => p.id === prodId);
                      const invItem = inventory.find((i) => i.productId === prodId && i.ownerId === selectedManufacturer);
                      const unitPrice = invItem?.price || invItem?.prixGros || prod?.prixGros || prod?.prixDetail || (prod as any)?.price || 1000;
                      return (
                        <div key={prodId} className="flex justify-between items-center text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="truncate max-w-[120px]">{prod?.name}</span>
                          <span className="font-mono">{qty} x {formatCFA(unitPrice)}</span>
                        </div>
                      );
                    })}
                </div>
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center font-bold">
                  <span>TOTAL ESTIMÉ</span>
                  <span className="font-mono text-emerald-600">
                    {formatCFA(
                      Object.keys(procureCart)
                        .filter((id) => procureCart[id] > 0)
                        .reduce((sum, id) => {
                          const prod = products.find((p) => p.id === id);
                          const invItem = inventory.find((i) => i.productId === id && i.ownerId === selectedManufacturer);
                          const unitPrice = invItem?.price || invItem?.prixGros || prod?.prixGros || prod?.prixDetail || (prod as any)?.price || 1000;
                          return sum + unitPrice * procureCart[id];
                        }, 0)
                    )}
                  </span>
                </div>
                <button
                  onClick={handleCheckoutProcure}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4" /> Passer la Commande de Gros
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Suivi de mes Achats Usine</h4>
          {myB2BOrders.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">Aucun achat passé pour le moment.</div>
          ) : (
            <div className="space-y-4">
              {myB2BOrders.map((order) => {
                const manufacturer = users.find((u) => u.id === order.receiverId);
                return (
                  <div key={order.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl space-y-3 shadow-xs">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold font-mono uppercase">
                          {order.id}
                        </span>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 mt-1">
                          Fabricant : {manufacturer?.companyName || manufacturer?.name} ({manufacturer?.country})
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Créée le : {new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.status === OrderStatus.PENDING ? "bg-amber-100 text-amber-700 font-bold" :
                            order.status === OrderStatus.CONFIRMED ? "bg-blue-100 text-blue-700 animate-pulse font-bold" :
                            order.status === OrderStatus.PREPARING ? "bg-purple-100 text-purple-700 font-bold" :
                            order.status === OrderStatus.READY ? "bg-teal-100 text-teal-700 font-bold" :
                            order.status === OrderStatus.SHIPPED ? "bg-indigo-100 text-indigo-700 font-bold" :
                            order.status === OrderStatus.DELIVERED ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-zinc-100 text-zinc-700 font-bold"
                          }`}>
                            Statut : {order.status}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}>
                            Paiement : {order.paymentStatus === "PAID" ? "PAYÉ" : "NON PAYÉ"}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-1">
                          {formatCFA(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-850 text-[11px] space-y-1">
                      {order.items.map((item, idx) => {
                        const prod = products.find((p) => p.id === item.productId);
                        return (
                          <div key={item.productId + '_' + idx} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                            <span>{prod?.name}</span>
                            <span className="font-mono">Qty: {item.quantity} x {formatCFA(item.priceAtOrder)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 justify-end items-center">
                      {order.paymentStatus !== "PAID" && (
                        <button
                          onClick={() => onPayOrder && onPayOrder(order.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                        >
                          <Landmark className="w-3.5 h-3.5" /> Régler la commande ({formatCFA(order.totalAmount)})
                        </button>
                      )}
                      {order.paymentStatus === "PAID" && (
                        <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                          ✓ Commande payée
                        </span>
                      )}
                    </div>
                    <OrderClaimAndConfirm
                      orderId={order.id}
                      status={order.status}
                      onConfirmReceipt={() => onUpdateOrderStatus(order.id, OrderStatus.DELIVERED)}
                      order={order}
                      products={products}
                      users={users}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeTab === "sales" && (
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Commandes B2B Reçues</h4>
              <SalesExportButton
                orders={incomingRetailerOrders}
                products={products}
                users={users}
                currentUserId={currentUser.id}
              />
            </div>
            {incomingRetailerOrders.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">Aucune commande B2B en attente.</div>
            ) : (
              <div className="space-y-4">
                {incomingRetailerOrders.map((order) => {
                  const shop = users.find((u) => u.id === order.senderId);
                  return (
                    <div key={order.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-bold font-mono uppercase">
                            {order.id}
                          </span>
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                            Acheteur : {shop?.companyName || shop?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.status === OrderStatus.PENDING ? "bg-amber-100 text-amber-700" :
                            order.status === OrderStatus.DELIVERED ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {order.status}
                          </span>
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-1">
                            {formatCFA(order.totalAmount)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-850 text-[11px] mb-3">
                        {order.items.map((item, idx) => {
                          const prod = products.find((p) => p.id === item.productId);
                          return (
                            <div key={item.productId + '_' + idx} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                              <span>{prod?.name}</span>
                              <span className="font-mono">{item.quantity} x {formatCFA(item.priceAtOrder)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 justify-end items-center flex-wrap">
                        {order.status === OrderStatus.PENDING && (
                          <>
                            <button
                              onClick={() => handleDiagnoseDelivery(order)}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1"
                              title="Diagnostiquer la livraison"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> Diagnostiquer
                            </button>
                            <button
                              onClick={() => onUpdateOrderStatus(order.id, OrderStatus.CONFIRMED)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold"
                            >
                              Confirmer
                            </button>
                          </>
                        )}
                        {/* ... other status logic can be added here ... */}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-4">Caisse Minute - Vente Directe</h4>
            <CaisseModule
              currentUser={currentUser}
              inventory={myInventory}
              products={products}
            lightClients={lightClients}
              users={users}
              orders={orders}
              payments={payments}
              onPlaceSale={onPlaceSale}
            />
          </div>
        </div>
      )}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <StockEvolutionBarChart inventory={inventory} products={products}
             currentUserId={currentUser.id} />
          <div className="flex justify-between items-center flex-wrap gap-2">
            <LowStockAlerts inventory={inventory} products={products}
             currentUserId={currentUser.id} />
            <div className="flex gap-2">
              <button
                onClick={() => handleExportInventoryCSV(inventory, products, currentUser.id)}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" /> Exporter l'inventaire CSV
              </button>
              <button
                onClick={() => setIsAddingStockModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" /> Ajouter / Gérer un produit au stock
              </button>
            </div>
          </div>
          <StockCategoryOrganizer
            inventory={inventory}
            products={products}
            currentUserId={currentUser.id}
            onUpdateInventory={onUpdateInventory}
            onDeleteInventoryItem={onDeleteInventoryItem}
            onEditProduct={(product, inventoryItem) => setEditingModalItem({ product, inventoryItem })}
            onOpenAddModal={() => setIsAddingStockModalOpen(true)}
            onExportCSV={() => handleExportInventoryCSV(inventory, products, currentUser.id)}
            title="Mon Stock de Gros par Catégorie"
            role={currentUser.role}
          />
          {/* Modal Ajout / Mise à jour de stock produit */}
          {isAddingStockModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Ajouter ou mettre à jour un produit en stock
                </h4>
                <p className="text-xs text-zinc-500">
                  Sélectionnez un produit. S'il existe déjà dans votre stock, la quantité sera automatiquement mise à jour (ajoutée) sans créer de doublon.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500">Produit</label>
                    <select
                      value={selectedProdToAdd}
                      onChange={(e) => {
                        setSelectedProdToAdd(e.target.value);
                        if (e.target.value !== "__NEW__") {
                          const found = products.find(p => p.id === e.target.value);
                          if (found) {
                            const existingInv = myInventory.find(i => i.productId === found.id);
                            if (existingInv) {
                              setPriceToAdd(existingInv.price.toString());
                            }
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs font-semibold"
                    >
                      <option value="">-- Sélectionner un produit --</option>
                      <option value="__NEW__">➕ Créer / Saisir un nouveau produit</option>
                      {products.map((p, idx) => (
                        <option key={`wh_prod_${p.id}_${idx}`} value={p.id}>{p.name} ({p.unit || 'Unité'})</option>
                      ))}
                    </select>
                  </div>
                  {selectedProdToAdd === "__NEW__" && (
                    <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Nom du nouveau produit</label>
                        <input
                          type="text"
                          placeholder="Ex: Riz Parfumé 50kg"
                          value={newProdName}
                          onChange={(e) => setNewProdName(e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Catégorie</label>
                          {!isCustomWholesaleCategory ? (
                            <div className="relative">
                              <select
                                value={PREDEFINED_CATEGORIES.includes(newProdCategory) ? newProdCategory : "AUTRE"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "AUTRE") {
                                    setIsCustomWholesaleCategory(true);
                                    setNewProdCategory("");
                                  } else {
                                    setNewProdCategory(val);
                                  }
                                }}
                                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold appearance-none pr-8 cursor-pointer"
                              >
                                {PREDEFINED_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                                <option value="AUTRE">➕ Autre (saisir manuellement)...</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-[9px]">
                                ▼
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                required
                                autoFocus
                                value={newProdCategory}
                                onChange={(e) => setNewProdCategory(e.target.value)}
                                placeholder="Catégorie..."
                                className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomWholesaleCategory(false);
                                  setNewProdCategory("Alimentation");
                                }}
                                className="px-1.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold transition text-[9px]"
                              >
                                Retour
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Unité</label>
                          <input
                            type="text"
                            value={newProdUnit}
                            onChange={(e) => setNewProdUnit(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Illustration du Produit</label>
                        <div className="flex gap-2 p-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg text-[10px] font-bold mb-2">
                          <button
                            type="button"
                            onClick={() => setUploadMode("file")}
                            className={`flex-1 py-1 rounded transition flex items-center justify-center gap-1 ${uploadMode === "file" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500"}`}
                          >
                            <Upload className="w-3.5 h-3.5" /> Fichier
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadMode("url")}
                            className={`flex-1 py-1 rounded transition flex items-center justify-center gap-1 ${uploadMode === "url" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500"}`}
                          >
                            <LinkIcon className="w-3.5 h-3.5" /> Lien URL
                          </button>
                        </div>
                        {uploadMode === "file" ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border border-dashed rounded-xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[90px] ${
                              isDragging ? "border-emerald-500 bg-emerald-50" : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            }`}
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept="image/*"
                              className="hidden"
                            />
                            {uploadedImage ? (
                              <div className="space-y-1 flex flex-col items-center">
                                <img src={uploadedImage} alt="Preview" className="h-12 w-12 object-cover rounded-lg shadow-xs" />
                                <span className="text-[9px] text-zinc-500">Image chargée (cliquer pour changer)</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Upload className="w-5 h-5 text-zinc-400 mx-auto" />
                                <p className="text-[10px] text-zinc-500">Glissez ou parcourez une image</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <input
                            type="url"
                            placeholder="https://images.unsplash.com/photo-..."
                            value={imageLinkInput}
                            onChange={(e) => setImageLinkInput(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold"
                          />
                        )}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500">Quantité à ajouter / définir</label>
                    <input
                      type="number"
                      value={quantityToAdd}
                      onChange={(e) => setQuantityToAdd(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500">Prix de gros unitaire (FCFA)</label>
                    <input
                      type="number"
                      value={priceToAdd}
                      onChange={(e) => setPriceToAdd(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setIsAddingStockModalOpen(false)}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      const qty = parseInt(quantityToAdd);
                      const pr = parseFloat(priceToAdd);
                      if (isNaN(qty) || qty <= 0) {
                        alert("Veuillez entrer une quantité valide.");
                        return;
                      }
                      if (selectedProdToAdd === "__NEW__") {
                        if (!newProdName.trim()) {
                          alert("Veuillez saisir le nom du nouveau produit.");
                          return;
                        }
                        if (!onCreateProduct) {
                          alert("Fonction de création non disponible.");
                          return;
                        }
                        const finalImg = uploadMode === "file" && uploadedImage ? uploadedImage : (imageLinkInput || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300");
                        onCreateProduct({
                          name: newProdName.trim(),
                          description: "Produit créé par le grossiste",
                          category: newProdCategory,
                          brand: currentUser.companyName || currentUser.name,
                          unit: newProdUnit,
                          weight: 1,
                          volume: 1,
                          image: finalImg,
                          barcode: Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
                          qrCode: `QR_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
                        }, qty, !isNaN(pr) ? pr : 15000);
                        setNewProdName("");
                        setUploadedImage("");
                        setImageLinkInput("");
                      } else if (selectedProdToAdd) {
                        const existing = myInventory.find(i => i.productId === selectedProdToAdd);
                        if (existing) {
                          const newStock = existing.stock + qty;
                          onUpdateInventory(existing.id, newStock, !isNaN(pr) ? pr : existing.price, existing.prixGros, existing.prixDetail, existing.quantiteMinimum, selectedProdToAdd);
                        } else {
                          onUpdateInventory('', qty, !isNaN(pr) ? pr : 15000, undefined, undefined, 5, selectedProdToAdd);
                        }
                      } else {
                        alert("Veuillez sélectionner ou créer un produit.");
                        return;
                      }
                      setIsAddingStockModalOpen(false);
                      setSelectedProdToAdd("");
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20"
                  >
                    Valider / Mettre à jour
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === "alerts" && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl text-amber-900 dark:text-amber-200 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-amber-200/50">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h4 className="font-bold text-xs uppercase tracking-wider">Analyse des Stocks détaillants (Afrique)</h4>
          </div>
          <p className="text-xs leading-relaxed">
            Notre système est connecté en direct aux stocks de vos détaillants affiliés pour vous proposer des réapprovisionnements automatiques proactifs.
          </p>
          <div className="bg-white dark:bg-zinc-900 p-3.5 border border-amber-150 rounded-xl space-y-3">
            <h5 className="font-bold text-xs text-amber-700 dark:text-amber-400">Boutique : Alimentation Générale Médina (Dakar)</h5>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
              <div className="p-2 bg-zinc-50 dark:bg-zinc-950 rounded">
                <span className="block font-semibold">Huile Dinor</span>
                <span className="text-amber-600 font-bold">3 cartons (Seuil : 15)</span>
              </div>
              <div className="p-2 bg-zinc-50 dark:bg-zinc-950 rounded">
                <span className="block font-semibold">Sucre Blond</span>
                <span className="text-amber-600 font-bold">2 cartons (Seuil : 5)</span>
              </div>
              <div className="p-2 bg-zinc-50 dark:bg-zinc-950 rounded">
                <span className="block font-semibold">Savon Geisha</span>
                <span className="text-rose-600 font-bold">RUPTURE</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === "clients" && (
        <div className="animate-fade-in">
          <ClientManagement 
            clients={lightClients}
            orders={orders}
            payments={payments}
            onCreateClient={onCreateLightClient}
            onDeleteClient={onDeleteLightClient}
            onAddPayment={onAddPayment}
            currentUserRole={currentUser.role}
            currentUser={currentUser}
            users={users}
            products={products}
            inventory={inventory}
          />
        </div>
      )}
      {activeTab === "sync" && (
        <div className="animate-fade-in">
          <SyncHistory queue={syncQueue} />
        </div>
      )}
      {activeTab === "accounting" && (
        <div className="animate-fade-in">
          <AccountingDashboard currentUserId={currentUser.id} orders={orders} />
        </div>
      )}
      {activeTab === "reviews" && (
        <div className="animate-fade-in">
          <PartnerReviewsSection
            connections={connections}
            currentUser={currentUser}
            users={users}
          />
        </div>
      )}
        </motion.div>
      </AnimatePresence>
      <CreateProductModal
        isOpen={isAddingStockModalOpen}
        onClose={() => setIsAddingStockModalOpen(false)}
        defaultBrand={currentUser.companyName || currentUser.name}
        onSubmit={(productData, stock, price, prixGros, prixDetail, quantiteMinimum, threshold, expirationDate) => {
          if (onCreateProduct) {
            onCreateProduct(productData, stock, price, prixGros, prixDetail, quantiteMinimum, threshold, expirationDate);
          }
          setIsAddingStockModalOpen(false);
        }}
      />
      <EditProductStockModal
        isOpen={!!editingModalItem}
        onClose={() => setEditingModalItem(null)}
        product={editingModalItem?.product || null}
        inventoryItem={editingModalItem?.inventoryItem || null}
        onDelete={(itemId, productId) => {
          onDeleteInventoryItem(itemId, productId, true);
          setEditingModalItem(null);
        }}
        onSave={(productId, productData, inventoryItemId, inventoryData) => {
          if (onUpdateProductFull) {
            onUpdateProductFull(productId, productData, inventoryItemId, inventoryData);
          } else {
            onUpdateInventory(
              inventoryItemId || "",
              inventoryData?.stock || 0,
              inventoryData?.price || 0,
              inventoryData?.prixGros,
              inventoryData?.prixDetail,
              inventoryData?.quantiteMinimum,
              productId
            );
          }
          setEditingModalItem(null);
        }}
      />
    </div>
  );
}
// ----------------------------------------------------------------------
// 4. RETAILER DASHBOARD
// ----------------------------------------------------------------------
interface RetailerDashboardProps {
  currentUser: UserProfile;
  products: Product[];
  inventory: InventoryItem[];
  orders: Order[];
  users: UserProfile[];
  lightClients: LightClient[];
  payments: DebtPayment[];
  connections?: Connection[];
  syncQueue: any[];
  isOnline: boolean;
  stockMovements?: StockMovement[];
  onPlaceB2BOrder: (receiverId: string, items: { productId: string; quantity: number }[]) => void;
  onUpdateInventory: (itemId: string, stock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, productId?: string) => void;
  onDeleteInventoryItem: (itemId: string, productId?: string, skipConfirm?: boolean) => void;
  onCreateProduct: (p: Omit<Product, "id" | "creatorId">, initialStock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, threshold?: number, expirationDate?: string) => void;
  onPlaceQuickB2CSale: (items: { productId: string; quantity: number }[]) => void;
  onPlaceSale: (clientId: string | "CASH_CLIENT", items: { productId: string; quantity: number }[], amountPaid: number, paymentMethod: Order["paymentMethod"]) => void;
  onCreateLightClient: (identifier: string, notes?: string, role?: any, isPartnerRegistration?: boolean) => void;
  onAddPayment: (clientId: string, amount: number) => void;
  onDeleteLightClient: (clientId: string) => void;
  onPayOrder?: (orderId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
  onUpdateCreditLimit?: (id: string, isRealUser: boolean, limit: number) => void;
  onUpdateProductFull?: (productId: string, productData: Partial<Product>, inventoryItemId?: string, inventoryData?: Partial<InventoryItem>) => void;
  favoriteProductIds?: string[];
  onSelectProduct?: (product: Product, inventoryItem?: InventoryItem) => void;
}
export function RetailerDashboard({
  currentUser,
  products,
  inventory,
  orders,
  users,
  lightClients,
  payments,
  connections = [],
  syncQueue,
  isOnline,
  stockMovements = [],
  onPlaceB2BOrder,
  onUpdateInventory,
  onDeleteInventoryItem,
  onCreateProduct,
  onPlaceQuickB2CSale,
  onPlaceSale,
  onCreateLightClient,
  onAddPayment,
  onDeleteLightClient,
  onPayOrder,
  onUpdateOrderStatus,
  onUpdateCreditLimit,
  onUpdateProductFull,
  favoriteProductIds = [],
  onSelectProduct,
}: RetailerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"sales_dashboard" | "dashboard" | "forecast" | "procure" | "purchases" | "sales" | "inventory" | "accounting" | "suppliers" | "buyers" | "clients" | "sync" | "reviews">("sales_dashboard");
  const [stockSort, setStockSort] = useState<"none" | "asc" | "desc">("none");
  const [selectedWholesaler, setSelectedWholesaler] = useState<string>("");
  const [procureCart, setProcureCart] = useState<Record<string, number>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingModalItem, setEditingModalItem] = useState<{ product: Product; inventoryItem: InventoryItem } | null>(null);
  const [selectedProdId, setSelectedProdId] = useState<string>("");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [posCart, setPosCart] = useState<Record<string, number>>({});
  const [posSelectedLightClientId, setPosSelectedLightClientId] = useState<string>("");
  const [posAmountPaid, setPosAmountPaid] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [retailerCategory, setRetailerCategory] = useState("Alimentation");
  const [isCustomRetailerCategory, setIsCustomRetailerCategory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [adjustingStockItem, setAdjustingStockItem] = useState<InventoryItem | null>(null);
  const [adjustingStockValue, setAdjustingStockValue] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isAdding) {
      setUploadedImage("");
      setUploadMode("file");
    }
  }, [isAdding]);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };
  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && event.target.result) {
        setUploadedImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };
  // Filter all Wholesalers and Semi-Wholesalers (prioritizing registered partners in CLIENTS & Adresses)
  const wholesalers = useMemo(() => {
    const partnerIds = new Set<string>();
    connections
      .filter(c => isConnectionActive(c) && (c.senderId === currentUser.id || c.receiverId === currentUser.id))
      .forEach(c => partnerIds.add(c.senderId === currentUser.id ? c.receiverId : c.senderId));
    lightClients
      .filter(lc => lc.ownerId === currentUser.id && lc.linkedUserId)
      .forEach(lc => partnerIds.add(lc.linkedUserId!));
    return users
      .filter((u) => {
        const uRole = u.role;
        const uStatus = (u.status || (u as any).statut || "").toLowerCase();
        const isActive = uStatus === "active" || uStatus === "actif" || !uStatus;
        return (
          (uRole === UserRole.WHOLESALER || uRole === UserRole.SEMI_WHOLESALER) &&
          isActive
        );
      })
      .sort((a, b) => {
        const aIsPartner = partnerIds.has(a.id) ? 1 : 0;
        const bIsPartner = partnerIds.has(b.id) ? 1 : 0;
        return bIsPartner - aIsPartner;
      });
  }, [users, connections, lightClients, currentUser.id]);
  // Shop Inventory
  const myInventory = useMemo(() => {
    return inventory.filter((i) => i.ownerId === currentUser.id || i.ownerId === currentUser.email);
  }, [inventory, currentUser]);
  // Shop Orders (Incoming B2C and B2B)
  const myB2COrders = useMemo(() => orders.filter((o) => o.receiverId === currentUser.id), [orders, currentUser.id]);
  // Outgoing B2B orders
  const myB2BOrders = useMemo(() => orders.filter((o) => o.senderId === currentUser.id && o.orderType.startsWith("B2B")), [orders, currentUser.id]);
  // Unique Buyers (B2B and B2C)
  const myBuyers = useMemo(() => {
    const buyerIds = new Set<string>();
    orders
      .filter(order => order.receiverId === currentUser.id || (order.senderId === currentUser.id && order.orderType === "B2C_R2C"))
      .forEach(order => {
        const id = order.senderId === currentUser.id ? order.receiverId : order.senderId;
        if (id && id !== currentUser.id && id !== "CASH_CLIENT") {
          buyerIds.add(id);
        }
      });
    lightClients
      .filter(lc => lc.ownerId === currentUser.id && lc.linkedUserId)
      .forEach(lc => {
        buyerIds.add(lc.linkedUserId!);
      });
    return Array.from(buyerIds)
      .map(id => users.find(u => u.id === id))
      .filter((u): u is UserProfile => !!u && u.role === UserRole.CLIENT);
  }, [orders, lightClients, users, currentUser.id]);
  const handleAddToCartProcure = (prodId: string, qty: number) => {
    setProcureCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handleCheckoutProcure = () => {
    if (!selectedWholesaler) {
      alert("Veuillez sélectionner un fournisseur (grossiste ou demi-grossiste) avant de passer commande.");
      return;
    }
    const items = Object.keys(procureCart)
      .filter((prodId) => procureCart[prodId] > 0)
      .map((prodId) => ({ productId: prodId, quantity: procureCart[prodId] }));
    if (items.length === 0) {
      alert("Votre panier d'approvisionnement est vide.");
      return;
    }
    onPlaceB2BOrder(selectedWholesaler, items);
    setProcureCart({});
    alert("Votre commande de réapprovisionnement a été transmise au fournisseur (Grossiste/Demi-Grossiste) !");
  };
  const handlePOSAddToCart = (prodId: string, qty: number) => {
    setPosCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handlePOSCheckout = async (saleData: any) => {
    try {
      const items = saleData.lignes.map((l: any) => ({ productId: l.produitId, quantity: l.quantite }));
      onPlaceSale(saleData.acheteurId || "CASH_CLIENT", items, posAmountPaid, "CASH");
      setPosCart({});
      setPosAmountPaid(0);
      setPosSelectedLightClientId("");
    } catch (e: any) {
      throw new Error("Erreur : " + e.message);
    }
  };
  const handleConfirmOrder = (orderId: string) => {
    onUpdateOrderStatus(orderId, OrderStatus.CONFIRMED);
  };
  const handleAssignDriver = (orderId: string, driverId: string) => {
    onUpdateOrderStatus(orderId, OrderStatus.DELIVERING, driverId);
  };
  const r2cDrivers = users.filter((u) => u.role === UserRole.DRIVER_R2C && u.status === "ACTIVE");
  const retailerExpirationAlerts = useMemo(() => {
    return inventoryService.checkExpirationAlerts(inventory, products, 15).filter(a => a.ownerId === currentUser.id || currentUser.role === UserRole.ADMIN);
  }, [inventory, products, currentUser]);
  return (
    <div className="space-y-6" id="retailer-dashboard">
      <ClaimsSummaryWidget orders={orders} users={users}
             currentUser={currentUser} onUpdateOrderStatus={onUpdateOrderStatus} />
      <DashboardTabBar
        title="Menu Détaillant - Opérations & Dashboard de Vente"
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as any)}
        syncStatus={{ isOnline, pendingCount: syncQueue.length }}
        accentColor="emerald"
        tabs={[
          { id: "sales_dashboard", label: "Dashboard de Vente", icon: TrendingUp },
          { id: "dashboard", label: "Tableau de Bord Personnalisé", icon: LayoutGrid },
          { id: "forecast", label: "Prévisions Stock IA", icon: Sparkles },
          { id: "procure", label: "Réappro Boutique", icon: Landmark },
          { id: "purchases", label: "Mes Achats", icon: ShoppingCart },
          { id: "sales", label: "Vente & Commandes", icon: ShoppingBag },
          { id: "inventory", label: "Mon Stock", icon: Layers },
          { id: "accounting", label: "Comptabilité", icon: Wallet },
          { id: "clients", label: "Clients & Adresses", icon: BookOpen },
          { id: "reviews", label: "Avis Partenaires", icon: MessageSquare },
          { id: "sync", label: "Sync", icon: Cloud, badge: syncQueue.length > 0 ? syncQueue.length : undefined },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {activeTab === "sales_dashboard" && (
            <div className="animate-fade-in">
              <MerchantSalesDashboard
                orders={orders}
                products={products}
                currentUser={currentUser}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onPlaceSale={onPlaceSale}
              />
            </div>
          )}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
              <ExpirationAlertsBanner alerts={retailerExpirationAlerts} />
              <CustomizableDashboard
                currentUser={currentUser}
                products={products}
                orders={orders}
                inventory={inventory}
                users={users}
                payments={payments}
            lightClients={lightClients}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onOpenReorderModal={() => setActiveTab("procure")}
                onOpenComparator={() => {
                  if (typeof window !== "undefined") {
                    const btn = document.getElementById("header-comparator-toggle");
                    if (btn) btn.click();
                  }
                }}
              />
              {onSelectProduct && (
                <FavoritesSection
                  favoriteIds={favoriteProductIds}
                  products={products}
                  inventory={inventory}
                  onSelectProduct={onSelectProduct}
                />
              )}
            </div>
          )}
          {activeTab === "forecast" && (
            <div className="animate-fade-in">
              <StockForecastModule
                products={products}
                orders={orders}
                currentUser={currentUser}
                onOpenReorderModal={() => setActiveTab("procure")}
                onOpenComparator={() => {
                  if (typeof window !== "undefined") {
                    const btn = document.getElementById("header-comparator-toggle");
                    if (btn) btn.click();
                  }
                }}
              />
            </div>
          )}
          {activeTab === "buyers" && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-150 dark:border-zinc-800">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Mes Acheteurs & Crédits</h4>
            <p className="text-[11px] text-zinc-500 mt-1">Identifiez clairement vos acheteurs (partenaires et locaux), suivez leurs volumes d'achats cumulés et gérez leurs encours de crédit (ardoises).</p>
          </div>
          <MyBuyersModule
            connections={connections}
            currentUser={currentUser}
            users={users}
            orders={orders}
            payments={payments}
            lightClients={lightClients}
            products={products}
            onAddPayment={onAddPayment}
            onUpdateCreditLimit={onUpdateCreditLimit}
            onCreateLightClient={onCreateLightClient}
          />
        </div>
      )}
      {activeTab === "procure" && (
        <div className="space-y-4">
          <SupplierSelector
            connections={connections}
            orders={orders}
            currentUser={currentUser}
            users={users}
            lightClients={lightClients}
            selectedSupplierId={selectedWholesaler}
            onSelectSupplier={(id) => {
              setSelectedWholesaler(id);
              setProcureCart({});
            }}
            onCreateLightClient={onCreateLightClient}
            targetRoles={[UserRole.MANUFACTURER, UserRole.WHOLESALER]}
            title="S'approvisionner : Achat auprès des Usines & Grossistes"
            description="Sélectionnez une usine ou un grossiste dans votre carnet d'adresses ou tapez son numéro ou email."
          />
          {selectedWholesaler && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-3">
                {(() => {
                  let ws = wholesalers.find(w => w.id === selectedWholesaler) as any;
                  if (!ws) {
                    ws = lightClients.find(lc => lc.id === selectedWholesaler) || users.find(u => u.id === selectedWholesaler);
                  }
                  if (!ws) return null;
                  return (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                      <div>
                        <h5 className="font-bold text-emerald-800 dark:text-emerald-400 text-xs uppercase tracking-wider">Informations du Fournisseur</h5>
                        <p className="text-zinc-700 dark:text-zinc-300 text-sm mt-1 font-semibold">{ws.name} {ws.companyName ? `(${ws.companyName})` : ''}</p>
                        <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-0.5">
                          📍 {ws.region || "Local"}, {ws.country || ""} {ws.sector ? `- ${ws.sector}` : ''}
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-zinc-700 dark:text-zinc-300 text-xs"><strong>Email:</strong> {ws.email || "Non renseigné"}</p>
                        <p className="text-zinc-700 dark:text-zinc-300 text-xs mt-0.5"><strong>Téléphone:</strong> {ws.phone || "Non renseigné"}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="md:col-span-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">Catalogue du Fournisseur</h5>
                <PredictiveSearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  products={products}
                  placeholder="Rechercher un produit ou catégorie..."
                  className="w-full sm:max-w-xs"
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">Articles de Gros Disponibles</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const directItems = inventory.filter((item) => item.ownerId === selectedWholesaler);
                    const creatorItems = products.filter(p => p.creatorId === selectedWholesaler).map(p => ({
                      id: `inv-${p.id}`,
                      productId: p.id,
                      ownerId: selectedWholesaler,
                      stock: 100,
                      threshold: p.lowStockThreshold || 10,
                      price: p.prixGros || p.prixDetail || 1000,
                      prixGros: p.prixGros,
                      prixDetail: p.prixDetail
                    }));
                    const catalogItems = products.map(p => ({
                      id: `cat-${p.id}`,
                      productId: p.id,
                      ownerId: selectedWholesaler,
                      stock: 999,
                      threshold: p.lowStockThreshold || 10,
                      price: p.prixGros || p.prixDetail || 1000,
                      prixGros: p.prixGros,
                      prixDetail: p.prixDetail
                    }));
                    const stockItems = directItems.length > 0 
                      ? directItems 
                      : (creatorItems.length > 0 ? creatorItems : catalogItems);
                    return stockItems.map((invItem) => {
                      const prod = products.find((p) => p.id === invItem.productId);
                      const matchesSearch = !searchQuery || 
                        (prod && (
                          prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (prod.category && prod.category.toLowerCase().includes(searchQuery.toLowerCase()))
                        ));
                      if (!prod || !matchesSearch) return null;
                      const stock = invItem.stock > 0 ? invItem.stock : 999;
                      const price = invItem.price || invItem.prixGros || prod.prixGros || prod.prixDetail || (prod as any).price || 1000;
                      return (
                        <div key={invItem.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-xl flex items-center justify-between">
                          <div className="flex gap-2 items-center min-w-0">
                            <img loading="lazy" src={prod.image} alt={prod.name} className="w-10 h-10 rounded object-cover" />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-zinc-950 dark:text-white truncate">{prod.name}</p>
                              <p className="text-[9px] text-zinc-500">Unité: {prod.unit} • En stock: {stock}</p>
                              <p className="text-xs font-bold text-emerald-600 font-mono mt-0.5">{formatCFA(price)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAddToCartProcure(prod.id, -1)}
                              disabled={!procureCart[prod.id]}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold">{procureCart[prod.id] || 0}</span>
                            <button
                              onClick={() => handleAddToCartProcure(prod.id, 1)}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold text-emerald-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              {/* Procure Basket */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 rounded-2xl h-fit space-y-4 text-xs">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Panier Réappro B2B</h5>
                <div className="space-y-2">
                  {Object.keys(procureCart)
                    .filter((prodId) => procureCart[prodId] > 0)
                    .map((prodId) => {
                      const qty = procureCart[prodId];
                      const prod = products.find((p) => p.id === prodId);
                      const invItem = inventory.find((i) => i.productId === prodId && i.ownerId === selectedWholesaler);
                      const unitPrice = invItem?.price || invItem?.prixGros || prod?.prixGros || prod?.prixDetail || (prod as any)?.price || 1000;
                      return (
                        <div key={prodId} className="flex justify-between items-center text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="truncate max-w-[120px]">{prod?.name}</span>
                          <span className="font-mono">{qty} x {formatCFA(unitPrice)}</span>
                        </div>
                      );
                    })}
                </div>
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center font-bold">
                  <span>TOTAL ESTIMÉ</span>
                  <span className="font-mono text-emerald-600">
                    {formatCFA(
                      Object.keys(procureCart)
                        .filter((id) => procureCart[id] > 0)
                        .reduce((sum, id) => {
                          const prod = products.find((p) => p.id === id);
                          const invItem = inventory.find((i) => i.productId === id && i.ownerId === selectedWholesaler);
                          const unitPrice = invItem?.price || invItem?.prixGros || prod?.prixGros || prod?.prixDetail || (prod as any)?.price || 1000;
                          return sum + unitPrice * procureCart[id];
                        }, 0)
                    )}
                  </span>
                </div>
                <button
                  onClick={handleCheckoutProcure}
                  disabled={Object.values(procureCart).every(q => q === 0)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4" /> Commander Appro
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Suivi de mes Achats Grossiste</h4>
          {myB2BOrders.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">Aucun achat passé pour le moment.</div>
          ) : (
            <div className="space-y-4">
              {myB2BOrders.map((order) => {
                const wholesaler = users.find((u) => u.id === order.receiverId);
                return (
                  <div key={order.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl space-y-3 shadow-xs">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold font-mono uppercase">
                          {order.id}
                        </span>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 mt-1">
                          {wholesaler?.role === UserRole.WHOLESALER ? "Grossiste" : "Demi-Grossiste"} : {wholesaler?.companyName || wholesaler?.name}
                        </p>
                        {wholesaler && (
                          <div className="mt-1 text-[10px] text-zinc-500 space-y-0.5">
                            <p>👤 {wholesaler.name}</p>
                            <p>📞 {wholesaler.phone} | ✉️ {wholesaler.email}</p>
                            <p>📍 {wholesaler.region}, {wholesaler.country} {wholesaler.sector ? `- ${wholesaler.sector}` : ''}</p>
                          </div>
                        )}
                        <p className="text-[10px] text-zinc-400 mt-1">Créée le : {new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.status === OrderStatus.PENDING ? "bg-amber-100 text-amber-700 font-bold" :
                            order.status === OrderStatus.CONFIRMED ? "bg-blue-100 text-blue-700 animate-pulse font-bold" :
                            order.status === OrderStatus.PREPARING ? "bg-purple-100 text-purple-700 font-bold" :
                            order.status === OrderStatus.READY ? "bg-teal-100 text-teal-700 font-bold" :
                            order.status === OrderStatus.SHIPPED ? "bg-indigo-100 text-indigo-700 font-bold" :
                            order.status === OrderStatus.DELIVERED ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-zinc-100 text-zinc-700 font-bold"
                          }`}>
                            Statut : {order.status}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            order.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}>
                            {order.paymentStatus === "PAID" ? (wholesaler?.role === UserRole.WHOLESALER ? "PAYÉ CHEZ LE GROSSISTE" : "PAYÉ CHEZ LE DEMI-GROSSISTE") : "PAIEMENT : NON PAYÉ"}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-1">
                          {formatCFA(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 text-[11px] space-y-1">
                      {order.items.map((item, idx) => {
                        const prod = products.find((p) => p.id === item.productId);
                        return (
                          <div key={item.productId + '_' + idx} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                            <span>{prod?.name}</span>
                            <span className="font-mono">Qty: {item.quantity} x {formatCFA(item.priceAtOrder)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 justify-end items-center">
                      {order.paymentStatus !== "PAID" && (
                        <button
                          onClick={() => onPayOrder && onPayOrder(order.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                        >
                          <Landmark className="w-3.5 h-3.5" /> Régler la commande ({formatCFA(order.totalAmount)})
                        </button>
                      )}
                      {order.paymentStatus === "PAID" && (
                        <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                          ✓ Commande payée
                        </span>
                      )}
                    </div>
                    <OrderClaimAndConfirm
                      orderId={order.id}
                      status={order.status}
                      onConfirmReceipt={() => onUpdateOrderStatus(order.id, OrderStatus.DELIVERED)}
                      order={order}
                      products={products}
                      users={users}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeTab === "sales" && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Commandes Reçues (Clients & Partenaires)</h4>
              <SalesExportButton
                orders={myB2COrders}
                products={products}
                users={users}
                currentUserId={currentUser.id}
              />
            </div>
            {myB2COrders.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs">Aucune commande client.</div>
            ) : (
              <div className="space-y-4">
                {myB2COrders.map((order) => {
                  const client = users.find((u) => u.id === order.senderId);
                  return (
                    <div key={order.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                       <div className="flex flex-col gap-1">
                          <p className="font-bold">{client?.name}</p>
                          <p className="text-zinc-500">{order.deliveryAddress}</p>
                          <div className="text-[10px] text-zinc-400 space-y-0.5 mt-1">
                            {order.items.map((item, idx) => {
                              const prod = products.find((p) => p.id === item.productId);
                              return <p key={item.productId + '_' + idx}>{prod?.name} x {item.quantity}</p>;
                            })}
                          </div>
                          <p className="font-mono font-bold text-emerald-600">{formatCFA(order.totalAmount)}</p>
                       </div>
                       <div className="flex flex-col gap-2">
                         <span className={`px-2 py-1 rounded-full font-bold text-center ${order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                           {order.status}
                         </span>
                         {order.status === OrderStatus.PENDING && (
                           <button onClick={() => handleConfirmOrder(order.id)} className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold">Confirmer</button>
                         )}
                         {order.status === OrderStatus.CONFIRMED && (
                           <select onChange={(e) => handleAssignDriver(order.id, e.target.value)} className="px-3 py-1 bg-zinc-100 rounded-lg">
                             <option value="">Assigner Livreur...</option>
                             {r2cDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                           </select>
                         )}
                       </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-4">Caisse Minute (POS Comptoir)</h4>
            <CaisseModule
              currentUser={currentUser}
              inventory={myInventory}
              products={products}
            lightClients={lightClients}
              users={users}
              orders={orders}
              payments={payments}
              onPlaceSale={onPlaceSale}
            />
          </div>
        </div>
      )}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <ExpirationAlertsBanner alerts={retailerExpirationAlerts} />
          <ThirtyDaySalesAndStockChart
            orders={orders}
            inventory={inventory}
            products={products}
            stockMovements={stockMovements}
            currentUserId={currentUser.id}
          />
          <LowStockAlerts inventory={inventory} products={products}
             currentUserId={currentUser.id} />
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">État des Stocks Boutique</h4>
            <button
              onClick={() => {
                setIsAdding(!isAdding);
                setSelectedProdId("");
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {isAdding ? "Fermer" : "Gérer mon Catalogue"}
            </button>
          </div>
          {isAdding && (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-4 animate-fade-in text-xs">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold uppercase text-[10px]">Rechercher ou Saisir un produit</label>
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-semibold"
                  >
                    <option value="">-- Sélectionner un produit du réseau --</option>
                    <option value="__NEW__">➕ Nouveau produit (N'existe pas dans la liste)</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                    ))}
                  </select>
                </div>
                {selectedProdId && selectedProdId !== "__NEW__" && (
                  <div className="flex-none">
                     {(() => {
                       const p = products.find(prod => prod.id === selectedProdId);
                       return p ? <img src={p.image} className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" alt="" /> : null;
                     })()}
                  </div>
                )}
              </div>
              {(selectedProdId === "__NEW__" || (selectedProdId && selectedProdId !== "__NEW__")) && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    if (selectedProdId === "__NEW__") {
                      // Determine the image link/base64 to use
                      let finalImage = "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300";
                      if (uploadMode === "file") {
                        if (uploadedImage) {
                          finalImage = uploadedImage;
                        }
                      } else {
                        const urlImg = fd.get("image") as string;
                        if (urlImg) {
                          finalImage = urlImg;
                        } else if (uploadedImage && uploadedImage.startsWith("http")) {
                          finalImage = uploadedImage;
                        }
                      }
                      const p = {
                        name: fd.get("name") as string,
                        description: fd.get("description") as string,
                        category: fd.get("category") as string,
                        brand: fd.get("brand") as string,
                        unit: fd.get("unit") as string,
                        weight: parseFloat(fd.get("weight") as string) || 0,
                        volume: parseFloat(fd.get("volume") as string) || 0,
                        image: finalImage, imageUrl: uploadMode === "url" ? (fd.get("image") as string || undefined) : undefined,
                        barcode: Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
                        qrCode: `QR_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                      };
                      onCreateProduct(p, parseInt(fd.get("stock") as string), parseFloat(fd.get("price") as string));
                    } else {
                      // Adding existing product
                      const existingProd = products.find(p => p.id === selectedProdId);
                      if (existingProd) {
                        const stock = parseInt(fd.get("stock") as string) || 0;
                        const price = parseFloat(fd.get("price") as string) || 0;
                        const existingInv = myInventory.find(i => i.productId === selectedProdId);
                        if (existingInv) {
                          onUpdateInventory(existingInv.id, existingInv.stock + stock, price, price, price, 1, selectedProdId);
                        } else {
                          onUpdateInventory("", stock, price, price, price, 1, selectedProdId);
                        }
                      }
                    }
                    setIsAdding(false);
                    setSelectedProdId("");
                    alert("Stock mis à jour avec succès !");
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in"
                >
                  {selectedProdId === "__NEW__" ? (
                    <>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Nom du produit</label>
                          <input required name="name" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                        </div>
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                          <textarea required name="description" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl h-20" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold">Catégorie</label>
                            {!isCustomRetailerCategory ? (
                              <div className="relative">
                                <select
                                  value={PREDEFINED_CATEGORIES.includes(retailerCategory) ? retailerCategory : "AUTRE"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "AUTRE") {
                                      setIsCustomRetailerCategory(true);
                                      setRetailerCategory("");
                                    } else {
                                      setRetailerCategory(val);
                                    }
                                  }}
                                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white appearance-none pr-8 cursor-pointer font-medium text-xs"
                                >
                                  {PREDEFINED_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                  <option value="AUTRE">➕ Autre (saisir manuellement)...</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-[9px]">
                                  ▼
                                </div>
                                <input type="hidden" name="category" value={retailerCategory} />
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  required
                                  autoFocus
                                  value={retailerCategory}
                                  onChange={(e) => setRetailerCategory(e.target.value)}
                                  placeholder="Saisir la catégorie..."
                                  className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium text-xs"
                                  name="category"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCustomRetailerCategory(false);
                                    setRetailerCategory("Alimentation");
                                  }}
                                  className="px-2.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold transition text-[10px]"
                                >
                                  Retour
                                </button>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Marque</label>
                            <input required name="brand" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Unité</label>
                            <input required name="unit" placeholder="Pièce / Carton" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Poids (kg)</label>
                            <input required type="number" step="0.1" name="weight" defaultValue="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1">Vol (m³)</label>
                            <input required type="number" step="0.01" name="volume" defaultValue="0.01" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Illustration du Produit</label>
                          <div className="flex gap-2 p-1 bg-zinc-150 dark:bg-zinc-800 rounded-lg text-[10px] font-bold mb-2">
                            <button
                              type="button"
                              onClick={() => setUploadMode("file")}
                              className={`flex-1 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1 ${uploadMode === "file" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-850"}`}
                            >
                              <Upload className="w-3.5 h-3.5" /> Uploader
                            </button>
                            <button
                              type="button"
                              onClick={() => setUploadMode("url")}
                              className={`flex-1 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1 ${uploadMode === "url" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-850"}`}
                            >
                              <LinkIcon className="w-3.5 h-3.5" /> Lien URL
                            </button>
                          </div>
                          {uploadMode === "file" ? (
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition duration-200 flex flex-col items-center justify-center min-h-[90px] ${
                                isDragging
                                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
                                  : "border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 bg-white dark:bg-zinc-800/50"
                              }`}
                            >
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                              />
                              {uploadedImage && !uploadedImage.startsWith("http") ? (
                                <div className="space-y-1 w-full flex flex-col items-center">
                                  <img loading="lazy" src={uploadedImage} alt="Preview" className="h-12 w-12 object-cover rounded-lg shadow-xs border border-zinc-200 dark:border-zinc-700" />
                                  <span className="text-[10px] text-zinc-500 font-medium">Image chargée.</span>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Upload className="w-5 h-5 text-zinc-400 mx-auto" />
                                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                                    Glissez-déposez ou <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline">parcourez</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="url"
                                name="image"
                                placeholder="https://images.unsplash.com/photo-..."
                                defaultValue={uploadedImage && uploadedImage.startsWith("http") ? uploadedImage : ""}
                                onChange={(e) => setUploadedImage(e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-4">
                      <div className="bg-white dark:bg-zinc-800 p-2 rounded-lg">
                        <Package className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-emerald-900 dark:text-emerald-400">Configuration du Stock</p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-500 mt-0.5">Vous allez ajouter <strong>{products.find(p => p.id === selectedProdId)?.name}</strong> à votre inventaire boutique.</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 md:col-span-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold">Quantité en Stock</label>
                      <input required name="stock" type="number" defaultValue="10" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono text-sm" />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold">Prix de Vente (FCFA)</label>
                      <input required name="price" type="number" step="1" placeholder="Ex: 500" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono text-sm" />
                    </div>
                  </div>
                  <div className="md:col-span-2 pt-2">
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
                      <Save className="w-4 h-4" /> {selectedProdId === "__NEW__" ? "Créer et Ajouter au Stock" : "Ajouter à mon Inventaire"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          <StockCategoryOrganizer
            inventory={inventory}
            products={products}
            currentUserId={currentUser.id}
            onUpdateInventory={onUpdateInventory}
            onDeleteInventoryItem={onDeleteInventoryItem}
            onEditProduct={(product, inventoryItem) => setEditingModalItem({ product, inventoryItem })}
            onOpenAddModal={() => setIsAdding(true)}
            onExportCSV={() => handleExportInventoryCSV(inventory, products, currentUser.id)}
            title="Stock & Rayons de la Boutique par Catégorie"
            role={currentUser.role}
          />
          {/* Stock Adjustment Modal */}
          {adjustingStockItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Ajuster la quantité en stock
                </h4>
                <p className="text-xs text-zinc-500">
                  Modifiez la quantité disponible pour cet article dans votre stock boutique.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Nouvelle quantité en stock</label>
                  <input
                    type="number"
                    value={adjustingStockValue}
                    onChange={(e) => setAdjustingStockValue(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-sm"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setAdjustingStockItem(null)}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      const qty = parseInt(adjustingStockValue);
                      if (!isNaN(qty) && qty >= 0) {
                        const updatedItem = { ...adjustingStockItem, stock: qty };
                        await inventoryService.updateInventoryItem(updatedItem);
                        onUpdateInventory(updatedItem.id, qty, updatedItem.price);
                        setAdjustingStockItem(null);
                      } else {
                        alert("Veuillez entrer une quantité valide.");
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === "suppliers" && (
        <SupplierSelector
          connections={connections}
          orders={orders}
          currentUser={currentUser}
          users={users}
          lightClients={lightClients}
          selectedSupplierId={selectedWholesaler}
          onSelectSupplier={(id) => {
            setSelectedWholesaler(id);
            setProcureCart({});
          }}
          onCreateLightClient={onCreateLightClient}
          targetRoles={[UserRole.WHOLESALER, UserRole.SEMI_WHOLESALER, UserRole.MANUFACTURER]}
          title="S'approvisionner : Achat auprès des Grossistes & Demi-Grossistes"
          description="Choisissez votre fournisseur (Grossiste, Demi-Grossiste ou Usine) dans votre carnet d'adresses."
        />
      )}
      {activeTab === "clients" && (
        <div className="animate-fade-in">
          <ClientManagement 
            clients={lightClients}
            orders={orders}
            payments={payments}
            onCreateClient={onCreateLightClient}
            onDeleteClient={onDeleteLightClient}
            onAddPayment={onAddPayment}
            currentUserRole={currentUser.role}
            currentUser={currentUser}
            users={users}
            products={products}
            inventory={inventory}
          />
        </div>
      )}
      {activeTab === "sync" && (
        <div className="animate-fade-in">
          <SyncHistory queue={syncQueue} />
        </div>
      )}
      {activeTab === "accounting" && (
        <div className="animate-fade-in">
          <AccountingDashboard currentUserId={currentUser.id} orders={orders} />
        </div>
      )}
      {activeTab === "reviews" && (
        <div className="animate-fade-in">
          <PartnerReviewsSection
            connections={connections}
            currentUser={currentUser}
            users={users}
          />
        </div>
      )}
        </motion.div>
      </AnimatePresence>
      <CreateProductModal
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        defaultBrand={currentUser.companyName || currentUser.name}
        onSubmit={(productData, stock, price, prixGros, prixDetail, quantiteMinimum, threshold, expirationDate) => {
          if (onCreateProduct) {
            onCreateProduct(productData, stock, price, prixGros, prixDetail, quantiteMinimum, threshold, expirationDate);
          }
          setIsAdding(false);
        }}
      />
      <EditProductStockModal
        isOpen={!!editingModalItem}
        onClose={() => setEditingModalItem(null)}
        product={editingModalItem?.product || null}
        inventoryItem={editingModalItem?.inventoryItem || null}
        onDelete={(itemId, productId) => {
          onDeleteInventoryItem(itemId, productId, true);
          setEditingModalItem(null);
        }}
        onSave={(productId, productData, inventoryItemId, inventoryData) => {
          if (onUpdateProductFull) {
            onUpdateProductFull(productId, productData, inventoryItemId, inventoryData);
          } else {
            onUpdateInventory(
              inventoryItemId || "",
              inventoryData?.stock || 0,
              inventoryData?.price || 0,
              inventoryData?.prixGros,
              inventoryData?.prixDetail,
              inventoryData?.quantiteMinimum,
              productId
            );
          }
          setEditingModalItem(null);
        }}
      />
    </div>
  );
}
// ----------------------------------------------------------------------
// 5. CLIENT DASHBOARD (B2C MARKETPLACE)
// ----------------------------------------------------------------------
interface ClientDashboardProps {
  currentUser: UserProfile;
  products: Product[];
  inventory: InventoryItem[];
  orders: Order[];
  users: UserProfile[];
  onPlaceB2COrder: (receiverId: string, items: { productId: string; quantity: number }[], address: string, method: string) => void;
  onPostReview: (orderId: string, rating: number, comment: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
  favoriteProductIds?: string[];
  onSelectProduct?: (product: Product, inventoryItem?: InventoryItem) => void;
}
export function ClientDashboard({
  currentUser,
  products,
  inventory,
  orders,
  users,
  onPlaceB2COrder,
  onPostReview,
  onUpdateOrderStatus,
  favoriteProductIds = [],
  onSelectProduct,
}: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState<"market" | "orders" | "addresses" | "feed">("feed");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"TOUS" | "EN_COURS" | "LIVRE" | "ANNULE">("TOUS");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedRetailer, setSelectedRetailer] = useState<string>("");
  const [shippingAddress, setShippingAddress] = useState(currentUser.address || "La Médina, Dakar");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [shippingFee, setShippingFee] = useState<number>(1000);
  const [shippingDistance, setShippingDistance] = useState<number>(1.5);
  const [shippingTime, setShippingTime] = useState<number>(5);
  const resolveRegionLabel = (addressOrRegion: string): string => {
    if (!addressOrRegion) return "Abidjan";
    const clean = addressOrRegion.toLowerCase();
    if (clean.includes("plateau") && clean.includes("dakar")) return "Dakar Plateau";
    if (clean.includes("médina") || clean.includes("medina")) return "La Médina";
    if (clean.includes("almadies")) return "Les Almadies";
    if (clean.includes("dakar")) return "Dakar";
    if (clean.includes("cocody")) return "Cocody";
    if (clean.includes("plateau")) return "Le Plateau";
    if (clean.includes("marcory")) return "Marcory";
    if (clean.includes("abidjan")) return "Abidjan";
    if (clean.includes("ouaga 2000") || clean.includes("ouagadougou")) return "Ouaga 2000 (Secteur 15)";
    if (clean.includes("koulouba")) return "Koulouba";
    return "Abidjan"; // Default fallback
  };
  // Identify connected suppliers (from previous orders)
  const connectedSupplierIds = Array.from(new Set(
      orders
        .filter(order => order.senderId === currentUser.id)
        .map(order => order.receiverId)
  ));
  // Feed data: recent updates from connected suppliers
  const feedItems = inventory
    .filter((inv) => connectedSupplierIds.includes(inv.ownerId) && inv.updatedAt)
    .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
    .map(inv => {
        const prod = products.find(p => p.id === inv.productId);
        const supplier = users.find(u => u.id === inv.ownerId);
        return { ...inv, prod, supplier };
    })
    .slice(0, 10);
  // Filter retailers and semi-wholesalers supplying client products
  const retailers = useMemo(() => {
    return users.filter((u) => {
      const roleOk = u.role === UserRole.RETAILER || u.role === UserRole.SEMI_WHOLESALER;
      const uStatus = (u.status || (u as any).statut || "").toLowerCase();
      const activeOk = uStatus === "active" || uStatus === "actif" || !uStatus;
      return roleOk && activeOk;
    });
  }, [users]);
  // Client past or present orders
  const myOrders = orders.filter((o) => o.senderId === currentUser.id);
  const selectedShopObj = users.find((u) => u.id === selectedRetailer);
  const getProductPrice = (invItem: InventoryItem | undefined, prod?: Product) => {
    if (selectedShopObj?.role === UserRole.SEMI_WHOLESALER) {
      return invItem?.prixDetail ?? invItem?.price ?? prod?.prixDetail ?? prod?.prixGros ?? (prod as any)?.price ?? 1000;
    }
    return invItem?.price ?? invItem?.prixDetail ?? prod?.prixDetail ?? (prod as any)?.price ?? 1000;
  };
  const shopStockItems = useMemo(() => {
    if (!selectedRetailer) return [];
    const directItems = inventory.filter((item) => item.ownerId === selectedRetailer);
    const creatorItems = products.filter(p => p.creatorId === selectedRetailer).map(p => ({
      id: `inv-${p.id}`,
      productId: p.id,
      ownerId: selectedRetailer,
      stock: 100,
      threshold: p.lowStockThreshold || 10,
      price: p.prixDetail || p.prixGros || (p as any).price || 1000,
      prixDetail: p.prixDetail,
      prixGros: p.prixGros
    }));
    const catalogItems = products.map(p => ({
      id: `cat-${p.id}`,
      productId: p.id,
      ownerId: selectedRetailer,
      stock: 999,
      threshold: p.lowStockThreshold || 10,
      price: p.prixDetail || p.prixGros || (p as any).price || 1000,
      prixDetail: p.prixDetail,
      prixGros: p.prixGros
    }));
    return directItems.length > 0 ? directItems : (creatorItems.length > 0 ? creatorItems : catalogItems);
  }, [inventory, products, selectedRetailer]);
  const handleAddToCart = (prodId: string, qty: number) => {
    setCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handleCheckout = () => {
    if (!selectedRetailer) {
      alert("Veuillez sélectionner un commerce (boutique ou demi-gros) avant de passer commande.");
      return;
    }
    const items = Object.keys(cart)
      .filter((prodId) => cart[prodId] > 0)
      .map((prodId) => ({ productId: prodId, quantity: cart[prodId] }));
    if (items.length === 0) {
      alert("Votre panier est vide.");
      return;
    }
    onPlaceB2COrder(selectedRetailer, items, shippingAddress, paymentMethod);
    setCart({});
    alert("Commande passée avec succès ! Vous pouvez suivre le livreur sur la carte en temps réel.");
  };
  return (
    <div className="space-y-6" id="client-dashboard">
      {/* Banner Publicitaire Dynamique - Offres Spéciales */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-white shadow-md group">
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent z-10" />
        <img
          src="/src/assets/images/promo_banner_offers_1784631282915.jpg"
          alt="Offres Spéciales Wakat ERP"
          className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-20 p-5 sm:p-6 max-w-lg space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-[9px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> Offre Spéciale d'Approvisionnement
          </div>
          <h3 className="text-base sm:text-lg font-bold tracking-tight">
            Remises exceptionnelles sur les commandes de gros & demi-gros !
          </h3>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            Optimisez vos stocks de produits de première nécessité (huiles, sodas, savon) avec des réductions immédiates.
          </p>
          <div className="pt-1.5 flex items-center gap-3">
            <button
              onClick={() => setActiveTab("market")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-xl transition flex items-center gap-1"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Profiter des remises
            </button>
            <span className="text-[9px] text-zinc-400 italic">Coordonné avec nos transporteurs locaux</span>
          </div>
        </div>
      </div>
      {/* Search and Navigation */}
      <DashboardTabBar
        title="Espace Client - Navigation"
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as any)}
        accentColor="emerald"
        tabs={[
          { id: "feed", label: "Fil d'actualité", icon: Sparkles },
          { id: "market", label: "Boutique & Produits locaux", icon: ShoppingBag },
          { id: "orders", label: "Mes Commandes & Suivi GPS", icon: ShoppingCart, badge: myOrders.filter((o) => o.status === OrderStatus.DELIVERING).length > 0 ? myOrders.filter((o) => o.status === OrderStatus.DELIVERING).length : undefined, highlight: myOrders.filter((o) => o.status === OrderStatus.DELIVERING).length > 0 },
          { id: "addresses", label: "Carnet d'Adresses", icon: MapPin },
        ]}
      />
      {activeTab === "feed" && (
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-4">Dernières alertes de vos fournisseurs</h4>
          {feedItems.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">Aucune actualité récente.</div>
          ) : (
            feedItems.map((item) => (
              <div key={item.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl flex items-center gap-4 hover:border-emerald-200 transition">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-lg flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-emerald-600"/>
                </div>
                <div className="flex-grow">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.prod?.name}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {item.supplier?.companyName || item.supplier?.name} • Stock : {item.stock} • {item.price} FCFA
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400 flex-shrink-0">
                  {new Date(item.updatedAt!).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}
                </p>
              </div>
            ))
          )}
        </div>
      )}
      {activeTab === "market" && (
        <div className="space-y-4">
          {/* Shop Selector Header */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-emerald-600" /> Catalogues des Détaillants & Demi-Grossistes
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Commandez en direct auprès de vos commerces de proximité et demi-grossistes partenaires.
                </p>
              </div>
              <PredictiveSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                products={products}
                placeholder="Rechercher des produits..."
                className="w-full sm:max-w-xs"
              />
            </div>
            {/* Select dropdown & Active Shop Header */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <select
                value={selectedRetailer}
                onChange={(e) => {
                  setSelectedRetailer(e.target.value);
                  setCart({});
                }}
                className="w-full sm:flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs bg-white dark:bg-zinc-850 font-medium text-zinc-900 dark:text-zinc-100 shadow-xs"
              >
                <option value="">-- Choisissez une Boutique ou Demi-Gros dans la liste --</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.companyName || r.name} ({r.role === UserRole.SEMI_WHOLESALER ? "Demi-Gros" : "Détaillant Boutique"} • {r.address || r.region || "Local"})
                  </option>
                ))}
              </select>
              {selectedRetailer && (
                <button
                  onClick={() => {
                    setSelectedRetailer("");
                    setCart({});
                  }}
                  className="px-3 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-zinc-300 transition whitespace-nowrap"
                >
                  Changer de Commerce
                </button>
              )}
            </div>
          </div>
          {/* Active Merchant Info Card */}
          {selectedShopObj && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{selectedShopObj.companyName || selectedShopObj.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedShopObj.role === UserRole.SEMI_WHOLESALER 
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                  }`}>
                    {selectedShopObj.role === UserRole.SEMI_WHOLESALER ? "Demi-Grossiste" : "Détaillant Boutique"}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  📍 {selectedShopObj.address || selectedShopObj.region || "Local"} • 📞 {selectedShopObj.phone || "Non renseigné"} • ✉️ {selectedShopObj.email}
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-3 py-1 rounded-lg">
                Catalogue Ouvert
              </span>
            </div>
          )}
          {!selectedRetailer ? (
            /* Vendor Selection Cards when no shop is selected */
            <div className="space-y-6">
              <div className="space-y-3">
                <h5 className="font-bold text-xs uppercase tracking-wider text-zinc-500">Commerces & Demi-Grossistes Disponibles</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {retailers.map((r) => {
                    const itemCount = inventory.filter(i => i.ownerId === r.id).length;
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedRetailer(r.id);
                          setCart({});
                        }}
                        className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl cursor-pointer transition shadow-xs hover:shadow-md group space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold text-base">
                            <Store className="w-5 h-5" />
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.role === UserRole.SEMI_WHOLESALER 
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                          }`}>
                            {r.role === UserRole.SEMI_WHOLESALER ? "Demi-Gros" : "Détaillant"}
                          </span>
                        </div>
                        <div>
                          <h5 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition">
                            {r.companyName || r.name}
                          </h5>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">
                            📍 {r.address || r.region || "Local"}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[11px] text-zinc-500 font-medium">
                          <span>{itemCount > 0 ? `${itemCount} articles en stock` : "Catalogue disponible"}</span>
                          <span className="font-bold text-emerald-600 group-hover:underline">Voir les produits &rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {onSelectProduct && (
                <FavoritesSection
                  favoriteIds={favoriteProductIds}
                  products={products}
                  inventory={inventory}
                  onSelectProduct={onSelectProduct}
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shopStockItems.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                    <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">Aucun produit disponible pour le moment chez ce commerçant.</p>
                  </div>
                ) : (
                  shopStockItems.map((invItem) => {
                    const prod = products.find((p) => p.id === invItem.productId);
                    const matchesSearch = !searchQuery || 
                      (prod && (
                        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (prod.category && prod.category.toLowerCase().includes(searchQuery.toLowerCase()))
                      ));
                    if (!prod || !matchesSearch) return null;
                    const stock = invItem.stock > 0 ? invItem.stock : 999;
                    const price = getProductPrice(invItem, prod);
                    return (
                      <div key={invItem.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-xl flex items-center justify-between shadow-sm">
                        <div className="flex gap-3 items-center min-w-0 flex-1">
                          <img loading="lazy" src={prod.image} alt={prod.name} className="w-12 h-12 rounded-lg object-cover shadow-xs" />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-zinc-950 dark:text-white truncate">{prod.name}</p>
                            <p className="text-[10px] text-zinc-500 font-medium">Dispo: {stock}</p>
                            <p className="text-xs font-bold text-emerald-600 font-mono mt-0.5">{formatCFA(price)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAddToCart(prod.id, -1)}
                              disabled={!cart[prod.id]}
                              className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 text-xs font-bold transition cursor-pointer"
                              title="Retirer"
                            >
                              -
                            </button>
                            <span className="w-7 text-center text-xs font-bold text-zinc-900 dark:text-white">{cart[prod.id] || 0}</span>
                            <button
                              onClick={() => {
                                if ((cart[prod.id] || 0) < stock) {
                                  handleAddToCart(prod.id, 1);
                                } else {
                                  alert("Stock insuffisant chez ce commerçant.");
                                }
                              }}
                              disabled={stock === 0}
                              className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-30 text-xs font-bold transition cursor-pointer"
                              title="Sélectionner"
                            >
                              +
                            </button>
                          </div>
                          <button 
                            onClick={() => {
                              if ((cart[prod.id] || 0) === 0) handleAddToCart(prod.id, 1);
                              document.querySelector('.checkout-panel')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-1 cursor-pointer"
                          >
                            Commander
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {/* Checkout panel */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 rounded-2xl h-fit space-y-4 text-xs checkout-panel">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Panier Client</h5>
                <div className="space-y-2">
                  {Object.keys(cart)
                    .filter((prodId) => cart[prodId] > 0)
                    .map((prodId) => {
                      const qty = cart[prodId];
                      const prod = products.find((p) => p.id === prodId);
                      const invItem = inventory.find((i) => i.productId === prodId && i.ownerId === selectedRetailer);
                      const unitPrice = getProductPrice(invItem, prod);
                      const total = unitPrice * qty;
                      return (
                        <div key={prodId} className="flex justify-between items-center text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="truncate max-w-[120px]">{prod?.name}</span>
                          <span className="font-mono">{qty} x {formatCFA(unitPrice)}</span>
                        </div>
                      );
                    })}
                </div>
                {/* Subtotal & Delivery details breakdown */}
                {Object.values(cart).some(q => (q as number) > 0) && (
                  <div className="pt-2.5 pb-1 space-y-1.5 border-t border-zinc-150">
                    <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                      <span>Sous-total</span>
                      <span className="font-mono">{formatCFA(
                        Object.keys(cart)
                          .filter((prodId) => cart[prodId] > 0)
                          .reduce((sum, prodId) => {
                            const qty = cart[prodId];
                            const prod = products.find((p) => p.id === prodId);
                            const invItem = inventory.find((i) => i.productId === prodId && i.ownerId === selectedRetailer);
                            const unitPrice = getProductPrice(invItem, prod);
                            return sum + unitPrice * qty;
                          }, 0)
                      )}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-500 font-medium">
                      <span>Frais Livraison ({shippingDistance} km)</span>
                      <span className="font-mono text-emerald-600 font-bold">+{formatCFA(shippingFee)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-900 dark:text-white font-bold text-xs pt-1.5 border-t border-dashed border-zinc-200">
                      <span>Total général</span>
                      <span className="font-mono text-emerald-600 font-extrabold">{formatCFA(
                        Object.keys(cart)
                          .filter((prodId) => cart[prodId] > 0)
                          .reduce((sum, prodId) => {
                            const qty = cart[prodId];
                            const prod = products.find((p) => p.id === prodId);
                            const invItem = inventory.find((i) => i.productId === prodId && i.ownerId === selectedRetailer);
                            const unitPrice = getProductPrice(invItem, prod);
                            return sum + unitPrice * qty;
                          }, 0) + shippingFee
                      )}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-3 pt-3 border-t border-zinc-150">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Adresse de livraison (Auto-complétion)</label>
                    <AddressAutocomplete
                      value={shippingAddress}
                      onChange={setShippingAddress}
                      users={users}
                      placeholder="Ex: Médina, Dakar ou Ouaga 2000..."
                      id="client-checkout-shipping-address"
                    />
                  </div>
                  {/* Real-time Dynamic Delivery Calculator widget */}
                  <OrderCreationDeliveryCalculator
                    sellerRegion={resolveRegionLabel(selectedShopObj?.address || selectedShopObj?.region || "Abidjan")}
                    buyerRegion={resolveRegionLabel(shippingAddress)}
                    onCalculateFee={(fee, dist, mins, resolvedBuyer) => {
                      setShippingFee(fee);
                      setShippingDistance(dist);
                      setShippingTime(mins);
                    }}
                    title="Estimation Frais de Livraison"
                    editableRegions={false}
                  />
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase">Moyen de Paiement</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-850"
                    >
                      <option value="CASH">Espèces à la livraison</option>
                      <option value="ORANGE_MONEY">Orange Money</option>
                      <option value="WAVE">Wave SN / CI</option>
                      <option value="MOOV_MONEY">Moov Money</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={Object.values(cart).every(q => q === 0)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" /> Commander & Suivre mon Livreur
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Historique & Suivi GPS en direct</h4>
            <div className="flex flex-wrap gap-2">
              {(["TOUS", "EN_COURS", "LIVRE", "ANNULE"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOrderStatusFilter(filter)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                    orderStatusFilter === filter 
                      ? "bg-emerald-600 text-white" 
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {filter === "TOUS" ? "Tous" : filter === "EN_COURS" ? "En cours" : filter === "LIVRE" ? "Livré" : "Annulé"}
                </button>
              ))}
            </div>
          </div>
          {myOrders.filter(order => {
            if (orderStatusFilter === "TOUS") return true;
            if (orderStatusFilter === "EN_COURS") return [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SHIPPED, OrderStatus.DELIVERING].includes(order.status);
            if (orderStatusFilter === "LIVRE") return order.status === OrderStatus.DELIVERED;
            if (orderStatusFilter === "ANNULE") return [OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(order.status);
            return true;
          }).length === 0 ? (
            <div className="text-center py-8 text-zinc-400">Aucune commande ne correspond à ce filtre.</div>
          ) : (
            <div className="space-y-4">
              {myOrders.filter(order => {
                if (orderStatusFilter === "TOUS") return true;
                if (orderStatusFilter === "EN_COURS") return [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SHIPPED, OrderStatus.DELIVERING].includes(order.status);
                if (orderStatusFilter === "LIVRE") return order.status === OrderStatus.DELIVERED;
                if (orderStatusFilter === "ANNULE") return [OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(order.status);
                return true;
              }).map((order) => (
                <div key={order.id} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl space-y-4 shadow-sm">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold font-mono">
                        {order.id}
                      </span>
                      <p className="text-xs font-semibold text-zinc-500 mt-1">Adresse : {order.deliveryAddress}</p>
                      <button
                        onClick={() => handleDownloadOrderPDF(order, products)}
                        className="mt-2 px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" /> Télécharger en PDF
                      </button>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        order.status === OrderStatus.DELIVERING ? "bg-emerald-100 text-emerald-700 animate-pulse" :
                        order.status === OrderStatus.DELIVERED ? "bg-zinc-100 text-zinc-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {order.status}
                      </span>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">{formatCFA(order.totalAmount)}</p>
                    </div>
                  </div>
                  {/* Dynamic tracking panel if active */}
                  {order.status === OrderStatus.DELIVERING && (
                    <div className="p-4 bg-zinc-950 text-white rounded-xl space-y-3 border border-zinc-800">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <Navigation className="w-3.5 h-3.5 animate-spin" /> Livreur en déplacement...
                        </span>
                        <span className="text-zinc-400 font-mono">Distance : {order.distanceKm} km • ETA : 4 mins</span>
                      </div>
                      {/* Map Animation */}
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Simulated streets Grid */}
                          <line x1="10" y1="0" x2="10" y2="100" stroke="#2a2a2a" strokeWidth="1" />
                          <line x1="50" y1="0" x2="50" y2="100" stroke="#2a2a2a" strokeWidth="1" />
                          <line x1="90" y1="0" x2="90" y2="100" stroke="#2a2a2a" strokeWidth="1" />
                          <line x1="0" y1="30" x2="100" y2="30" stroke="#2a2a2a" strokeWidth="1" />
                          <line x1="0" y1="70" x2="100" y2="70" stroke="#2a2a2a" strokeWidth="1" />
                          {/* Route line */}
                          <path d="M10,30 L50,30 L50,70 L90,70" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="5" className="animate-[dash_10s_linear_infinite]" />
                        </svg>
                        {/* Starting Node */}
                        <div className="absolute top-[30%] left-[10%] -translate-x-1/2 -translate-y-1/2 bg-blue-600 p-1.5 rounded-full z-10 shadow-lg">
                          <MapPin className="w-3.5 h-3.5 text-white" />
                        </div>
                        {/* Ending Node */}
                        <div className="absolute top-[70%] left-[90%] -translate-x-1/2 -translate-y-1/2 bg-rose-600 p-1.5 rounded-full z-10 shadow-lg animate-pulse">
                          <MapPin className="w-3.5 h-3.5 text-white" />
                        </div>
                        {/* Simulated live moving car / delivery guy */}
                        <div className="absolute top-[30%] left-[30%] -translate-x-1/2 -translate-y-1/2 bg-emerald-600 p-2 rounded-full z-20 shadow-xl animate-bounce">
                          <Truck className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      {/* OTP code needed to validate reception */}
                      <div className="bg-zinc-900 p-3 rounded-lg flex justify-between items-center border border-zinc-850">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">CODE OTP DE LIVRAISON</span>
                        <span className="font-mono font-bold text-base text-emerald-400 tracking-widest bg-zinc-950 px-3 py-1 rounded">
                          {order.otpCode || "2048"}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Post-delivery Client Review Form */}
                  {order.status === OrderStatus.DELIVERED && (
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-2 flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Noter votre livraison
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const comment = (e.currentTarget.querySelector("textarea") as HTMLTextAreaElement).value;
                          onPostReview(order.id, 5, comment);
                          alert("Merci beaucoup pour vos commentaires précieux !");
                        }}
                        className="space-y-2 text-xs"
                      >
                        <textarea placeholder="Donnez votre avis sur le livreur, le commerce ou la qualité des produits..." className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg focus:outline-none" />
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-bold">
                          Soumettre l'avis
                        </button>
                      </form>
                    </div>
                  )}
                  <OrderClaimAndConfirm
                    orderId={order.id}
                    status={order.status}
                    onConfirmReceipt={() => onUpdateOrderStatus(order.id, OrderStatus.DELIVERED)}
                    onAddClaim={(msg) => onUpdateOrderStatus(order.id, order.status, undefined, msg, "OPEN")}
                    order={order}
                    products={products}
                    users={users}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "addresses" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Mes Adresses Enregistrées</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl flex justify-between items-center">
              <div>
                <p className="font-bold text-zinc-900 dark:text-white">📍 Maison Principale</p>
                <p className="text-[11px] text-zinc-500 mt-1">{currentUser.address}</p>
              </div>
              <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold">Défaut</span>
            </div>
            <button className="p-3 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 font-semibold hover:border-zinc-500 hover:text-zinc-600 transition">
              + Ajouter une adresse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ----------------------------------------------------------------------
// 6. DRIVER DASHBOARD (ALL 3 ROLES: Driver M2W, W2R, R2C)
// ----------------------------------------------------------------------
interface DriverDashboardProps {
  currentUser: UserProfile;
  orders: Order[];
  users: UserProfile[];
  products: Product[];
  onCompleteDelivery: (orderId: string, otpInput?: string, sig?: string, img?: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
}
export function DriverDashboard({
  currentUser,
  orders,
  users,
  products,
  onCompleteDelivery,
  onUpdateOrderStatus,
}: DriverDashboardProps) {
  const [signatureData, setSignatureData] = useState<string>("");
  const [otpInput, setOtpInput] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [photoMockActive, setPhotoMockActive] = useState(false);
  // Filter orders assigned to this driver
  const myAssignedOrders = orders.filter((o) => o.driverId === currentUser.id);
  // Canvas drawing logic for digital signature pad
  const [isDrawing, setIsDrawing] = useState(false);
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };
  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData("");
    }
  };
  return (
    <div className="space-y-6" id="driver-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Missions Logistiques & Tournées</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Pilote de transport connecté au réseau national</p>
        </div>
        <div className="self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
            <Truck className="w-3.5 h-3.5" />
            {currentUser.role === UserRole.DRIVER_M2W && "Acheminement Usine ➔ Grossiste"}
            {currentUser.role === UserRole.DRIVER_W2SG && "Acheminement Grossiste ➔ Demi-Grossiste"}
            {currentUser.role === UserRole.DRIVER_W2R && "Distribution Grossiste ➔ Détaillant"}
            {currentUser.role === UserRole.DRIVER_SG2R && "Distribution Demi-Grossiste ➔ Détaillant"}
            {currentUser.role === UserRole.DRIVER_R2C && "Livraison Dernier Kilomètre Détaillant ➔ Client"}
          </span>
        </div>
      </div>
      {myAssignedOrders.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <Truck className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">Aucune mission d'acheminement assignée pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myAssignedOrders.map((order) => {
            const client = users.find((u) => u.id === order.senderId);
            const vendor = users.find((u) => u.id === order.receiverId);
            return (
              <div key={order.id} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-xs space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold font-mono">
                      {order.id}
                    </span>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mt-2">
                      Départ : {vendor?.companyName || vendor?.name}
                    </p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mt-1">
                      Arrivée : {client?.companyName || client?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-zinc-150 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full font-bold">
                      {order.status}
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-2">Distance : {order.distanceKm} km</p>
                  </div>
                </div>
                {/* Live Driver Interactive route map simulator */}
                {order.status === OrderStatus.DELIVERING && (
                  <div className="p-4 bg-zinc-950 text-white rounded-xl space-y-4 border border-zinc-850">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-emerald-400">
                      <Navigation className="w-4 h-4 animate-bounce" /> Itinéraire GPS en cours (Assistant Route)
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 bg-zinc-900 p-2.5 rounded border border-zinc-800 font-mono mb-3">
                      <span>Volume Cargo : {order.items.reduce((sum, i) => sum + i.quantity, 0)} colis</span>
                      <span>ETA Estimé : {order.estimatedTimeMins} mins</span>
                    </div>
                    {/* Package contents display */}
                    <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800 text-[10px] space-y-1 mb-3">
                      <p className="font-bold text-zinc-300 uppercase tracking-wider mb-1.5 border-b border-zinc-800 pb-1">Contenu du Colis</p>
                      {order.items.map((item, idx) => {
                        const prod = products.find((p) => p.id === item.productId);
                        return (
                          <div key={item.productId + '_' + idx} className="flex justify-between text-zinc-400">
                            <span>{prod?.name || "Produit inconnu"}</span>
                            <span className="font-mono text-zinc-500">x{item.quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Security digital verification tools for Retailer/Client validation */}
                    <div className="space-y-3 pt-3 border-t border-zinc-800">
                      {/* 1. Client OTP check (R2C driver only) */}
                      {currentUser.role === UserRole.DRIVER_R2C && (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase">Saisir le Code de validation Client (OTP)</label>
                          <input
                            type="text"
                            placeholder="Entrez le code OTP 4 chiffres..."
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            className="w-full mt-1.5 px-3 py-2 border border-zinc-750 bg-zinc-900 text-white font-mono rounded-lg text-xs"
                          />
                        </div>
                      )}
                      {/* 2. Photo attachment */}
                      <div>
                        <button
                          onClick={() => setPhotoMockActive(true)}
                          className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800 transition"
                        >
                          <Camera className="w-4 h-4" /> Prendre une photo justificative (Optionnel)
                        </button>
                        {photoMockActive && (
                          <p className="text-[9px] text-emerald-400 mt-1 font-mono">✓ Photo enregistrée : [COLIS_LIVRE_SEUIL.jpg]</p>
                        )}
                      </div>
                      {/* 3. Digital signature Canvas pad */}
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Émargement / Signature Numérique</label>
                        <div className="relative border border-zinc-800 rounded-lg overflow-hidden bg-white">
                          <canvas
                            ref={canvasRef}
                            width={300}
                            height={120}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            className="w-full h-[120px] cursor-crosshair touch-none"
                          />
                          <button
                            onClick={clearCanvas}
                            className="absolute bottom-2 right-2 text-[9px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-2 py-1 rounded"
                          >
                            Effacer
                          </button>
                        </div>
                      </div>
                      {/* Final Complete dispatch validation action */}
                      <button
                        onClick={() => {
                          if (currentUser.role === UserRole.DRIVER_R2C && otpInput !== (order.otpCode || "2048")) {
                            alert("Code OTP invalide. Veuillez demander le code de livraison au client.");
                            return;
                          }
                          onCompleteDelivery(order.id, otpInput, signatureData || undefined);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" /> Valider la livraison
                      </button>
                    </div>
                  </div>
                )}
                {/* Driver accepts missions state buttons */}
                {order.status === OrderStatus.SHIPPED && (
                  <button
                    onClick={() => onUpdateOrderStatus(order.id, OrderStatus.DELIVERING)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-4 h-4" /> Prendre en charge la mission (Départ)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ----------------------------------------------------------------------
// 7. SEMI-WHOLESALER (DEMI-GROSSISTE) DASHBOARD
// ----------------------------------------------------------------------
interface SemiWholesalerDashboardProps {
  currentUser: UserProfile;
  products: Product[];
  inventory: InventoryItem[];
  orders: Order[];
  users: UserProfile[];
  lightClients: LightClient[];
  payments: DebtPayment[];
  connections?: Connection[];
  syncQueue: any[];
  isOnline: boolean;
  stockMovements?: StockMovement[];
  onPlaceB2BOrder: (receiverId: string, items: { productId: string; quantity: number }[]) => void;
  onUpdateInventory: (itemId: string, stock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, productId?: string) => void;
  onDeleteInventoryItem: (itemId: string, productId?: string, skipConfirm?: boolean) => void;
  onCreateProduct?: (p: Omit<Product, "id" | "creatorId">, initialStock: number, price: number, prixGros?: number, prixDetail?: number, quantiteMinimum?: number, threshold?: number, expirationDate?: string) => void;
  onPlaceQuickB2CSale?: (items: { productId: string; quantity: number }[]) => void;
  onPlaceSale: (clientId: string | "CASH_CLIENT", items: { productId: string; quantity: number }[], amountPaid: number, paymentMethod: Order["paymentMethod"]) => void;
  onCreateLightClient: (identifier: string, notes?: string, role?: any, isPartnerRegistration?: boolean) => void;
  onAddPayment: (clientId: string, amount: number) => void;
  onDeleteLightClient: (clientId: string) => void;
  onPayOrder?: (orderId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
  onUpdateCreditLimit?: (id: string, isRealUser: boolean, limit: number) => void;
  onUpdateProductFull?: (productId: string, productData: Partial<Product>, inventoryItemId?: string, inventoryData?: Partial<InventoryItem>) => void;
  favoriteProductIds?: string[];
  onSelectProduct?: (product: Product, inventoryItem?: InventoryItem) => void;
}
export function SemiWholesalerDashboard({
  currentUser,
  products,
  inventory,
  orders,
  users,
  lightClients,
  payments,
  connections = [],
  syncQueue,
  isOnline,
  stockMovements = [],
  onPlaceB2BOrder,
  onUpdateInventory,
  onDeleteInventoryItem,
  onCreateProduct,
  onPlaceQuickB2CSale,
  onPlaceSale,
  onCreateLightClient,
  onAddPayment,
  onDeleteLightClient,
  onPayOrder,
  onUpdateOrderStatus,
  onUpdateCreditLimit,
  onUpdateProductFull,
  favoriteProductIds = [],
  onSelectProduct,
}: SemiWholesalerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"sales_dashboard" | "dashboard" | "procure" | "purchases" | "incoming" | "pos" | "inventory" | "accounting" | "buyers" | "clients" | "sync" | "reviews">("sales_dashboard");
  const handleDiagnoseDelivery = async (order: Order) => {
    import("../services/connectionService").then(async ({ connectionService }) => {
      const diag = await connectionService.validateRelationshipActive(order.senderId, order.receiverId);
      if (diag.isActive) {
        alert("Diagnostic ✅ : Le partenariat B2B est correctement configuré et actif. La livraison peut s'effectuer normalement.");
      } else {
        if (confirm(`Diagnostic ⚠️ : Problème de partenariat détecté (${diag.statut}). Voulez-vous réparer automatiquement cette connexion pour autoriser la livraison ?`)) {
          let connectionId = diag.relationId;
          if (!connectionId) {
             const senderObj = users.find(u => u.id === order.senderId);
             if (senderObj) {
                 const req = await connectionService.envoyerDemandeConnexion(currentUser, senderObj, "Auto-diagnostic");
                 connectionId = req.relationId;
             }
          }
          if (connectionId) {
              await connectionService.acceptConnection(connectionId, currentUser.id);
              alert("Réparation effectuée avec succès ! Le partenariat est maintenant actif.");
          } else {
              alert("Impossible de réparer automatiquement : le compte acheteur est introuvable.");
          }
        }
      }
    });
  };
  const [selectedWholesaler, setSelectedWholesaler] = useState<string>("");
  const [procureCart, setProcureCart] = useState<Record<string, number>>({});
  const [posCart, setPosCart] = useState<Record<string, number>>({});
  const [posCustomerType, setPosCustomerType] = useState<"RETAILER" | "CLIENT" | "LIGHT_CLIENT">("RETAILER");
  const [posSelectedLightClientId, setPosSelectedLightClientId] = useState<string>("");
  const [posAmountPaid, setPosAmountPaid] = useState<number>(0);
  const [posReceipt, setPosReceipt] = useState<{ id: string; date: string; items: any[]; total: number; customerType: string } | null>(null);
  const [stockSort, setStockSort] = useState<"none" | "asc" | "desc">("none");
  // Full product edit modal state
  const [editingModalItem, setEditingModalItem] = useState<{ product: Product; inventoryItem: InventoryItem } | null>(null);
  // Edit stock state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editPrixGros, setEditPrixGros] = useState<number>(0);
  const [editPrixDetail, setEditPrixDetail] = useState<number>(0);
  const [editMinQty, setEditMinQty] = useState<number>(1);
  // Product addition state
  const [isAdding, setIsAdding] = useState(false);
  const [semiWholesalerCategory, setSemiWholesalerCategory] = useState("Alimentation");
  const [isCustomSemiWholesalerCategory, setIsCustomSemiWholesalerCategory] = useState(false);
  const [selectedProdId, setSelectedProdId] = useState("");
  const [newStock, setNewStock] = useState(10);
  const [newPrice, setNewPrice] = useState(1000);
  const [newPrixGros, setNewPrixGros] = useState(1000);
  const [newPrixDetail, setNewPrixDetail] = useState(150);
  const [newMinQty, setNewMinQty] = useState(5);
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!isAdding) {
      setUploadedImage("");
      setUploadMode("url");
      setSelectedProdId("");
    }
  }, [isAdding]);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };
  const handleFileProcess = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && event.target.result) {
        setUploadedImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };
  // Filter wholesalers (suppliers)
  const wholesalers = useMemo(() => {
    return users.filter((u) => {
      const uRole = u.role;
      const uStatus = (u.status || (u as any).statut || "").toLowerCase();
      const isActive = uStatus === "active" || uStatus === "actif" || !uStatus;
      return (
        uRole === UserRole.WHOLESALER && 
        isActive
      );
    });
  }, [users]);
  const myInventory = useMemo(() => {
    return inventory.filter((i) => i.ownerId === currentUser.id || i.ownerId === currentUser.email);
  }, [inventory, currentUser]);
  const myLightClientIds = useMemo(() => {
    return new Set(
      lightClients
        .filter(lc => lc.ownerId === currentUser.id || lc.linkedUserId === currentUser.id)
        .map(lc => lc.id)
    );
  }, [lightClients, currentUser.id]);
  const incomingOrders = useMemo(() => {
    return orders.filter((o) => 
      o.receiverId === currentUser.id || 
      myLightClientIds.has(o.receiverId) ||
      (currentUser.email && o.receiverId === currentUser.email)
    );
  }, [orders, currentUser.id, myLightClientIds, currentUser.email]);
  const myPurchases = useMemo(() => {
    return orders.filter((o) => o.senderId === currentUser.id && o.orderType.startsWith("B2B"));
  }, [orders, currentUser.id]);
  const sg2rDrivers = users.filter((u) => u.role === UserRole.DRIVER_SG2R && u.status === "ACTIVE");
  const r2cDrivers = users.filter((u) => u.role === UserRole.DRIVER_R2C && u.status === "ACTIVE");
  // Selected driver per order
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  // Persistent Order Archiving & Active Orders Filter State
  const [archivedOrderIds, setArchivedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("wakat_archived_order_ids");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [orderFilterMode, setOrderFilterMode] = useState<"active_only" | "all" | "archived">("active_only");
  const [orderSortOrder, setOrderSortOrder] = useState<SortOrder>("desc");
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
  const activeIncomingOrders = useMemo(() => {
    return incomingOrders.filter(o => !archivedOrderIds.includes(o.id));
  }, [incomingOrders, archivedOrderIds]);
  const archivedIncomingOrders = useMemo(() => {
    return incomingOrders.filter(o => archivedOrderIds.includes(o.id));
  }, [incomingOrders, archivedOrderIds]);
  const displayedIncomingOrders = useMemo(() => {
    if (orderFilterMode === "active_only") return activeIncomingOrders;
    if (orderFilterMode === "archived") return archivedIncomingOrders;
    return incomingOrders;
  }, [orderFilterMode, activeIncomingOrders, archivedIncomingOrders, incomingOrders]);
  const sortedDisplayedIncomingOrders = useMemo(() => {
    const list = [...displayedIncomingOrders];
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return orderSortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [displayedIncomingOrders, orderSortOrder]);
  const handleClearAllIncomingOrders = () => {
    const idsToArchive = sortedDisplayedIncomingOrders.map(o => o.id);
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
  // Calculations for dashboard
  const totalProcurementCost = myPurchases.reduce((sum, o) => sum + o.totalAmount, 0);
  const incomingCompletedSales = incomingOrders.filter((o) => o.status === OrderStatus.DELIVERED);
  const wholesaleSalesVal = incomingCompletedSales
    .filter((o) => o.orderType === "B2B_SG2R")
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const retailSalesVal = incomingCompletedSales
    .filter((o) => o.orderType === "B2C_SG2C")
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const totalSalesRevenue = wholesaleSalesVal + retailSalesVal;
  const activeAlerts = myInventory.filter((item) => item.stock <= item.threshold);
  // Unique Buyers (B2B and B2C)
  const myBuyers = useMemo(() => {
    const buyerIds = new Set<string>();
    orders
      .filter(order => order.receiverId === currentUser.id || (order.senderId === currentUser.id && (order.orderType === "B2C_SG2C" || order.orderType === "B2B_SG2R")))
      .forEach(order => {
        const id = order.senderId === currentUser.id ? order.receiverId : order.senderId;
        if (id && id !== currentUser.id && id !== "CASH_CLIENT") {
          buyerIds.add(id);
        }
      });
    lightClients
      .filter(lc => lc.ownerId === currentUser.id && lc.linkedUserId)
      .forEach(lc => {
        buyerIds.add(lc.linkedUserId!);
      });
    return Array.from(buyerIds)
      .map(id => users.find(u => u.id === id))
      .filter((u): u is UserProfile => !!u && [UserRole.RETAILER, UserRole.CLIENT].includes(u.role));
  }, [orders, lightClients, users, currentUser.id]);
  const handleAddToCartProcure = (prodId: string, qty: number) => {
    setProcureCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handleCheckoutProcure = () => {
    if (!selectedWholesaler) {
      alert("Veuillez sélectionner un grossiste avant de passer commande.");
      return;
    }
    const items = Object.keys(procureCart)
      .filter((id) => procureCart[id] > 0)
      .map((id) => ({ productId: id, quantity: procureCart[id] }));
    if (items.length === 0) {
      alert("Votre panier d'approvisionnement est vide.");
      return;
    }
    onPlaceB2BOrder(selectedWholesaler, items);
    setProcureCart({});
    alert("Votre commande d'approvisionnement B2B auprès du grossiste a été envoyée !");
    setActiveTab("purchases");
  };
  const handleAddToPOSCart = (prodId: string, qty: number) => {
    setPosCart((prev) => ({
      ...prev,
      [prodId]: Math.max(0, (prev[prodId] || 0) + qty),
    }));
  };
  const handleCheckoutPOS = () => {
    const items = Object.keys(posCart)
      .filter((id) => posCart[id] > 0)
      .map((id) => ({
        productId: id,
        quantity: posCart[id]
      }));
    if (items.length === 0) return;
    const clientId = posCustomerType === "LIGHT_CLIENT" ? posSelectedLightClientId : "CASH_CLIENT";
    if (posCustomerType === "LIGHT_CLIENT" && !posSelectedLightClientId) {
      alert("Veuillez sélectionner un client pour une vente à crédit.");
      return;
    }
    onPlaceSale(
      clientId,
      items,
      posAmountPaid,
      "CASH"
    );
    setPosCart({});
    setPosAmountPaid(0);
    alert("Vente enregistrée avec succès au Point de Vente !");
  };
  const startEditItem = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditStock(item.stock);
    setEditPrice(item.price);
    setEditPrixGros(item.prixGros || item.price || 0);
    setEditPrixDetail(item.prixDetail || 0);
    setEditMinQty(item.quantiteMinimum || 1);
  };
  const saveEditItem = () => {
    if (!editingItemId) return;
    onUpdateInventory(editingItemId, editStock, editPrice, editPrixGros, editPrixDetail, editMinQty);
    setEditingItemId(null);
    alert("Stock et tarifs mis à jour avec succès !");
  };
  const semiWholesalerExpirationAlerts = useMemo(() => {
    return inventoryService.checkExpirationAlerts(inventory, products, 15).filter(a => a.ownerId === currentUser.id || currentUser.role === UserRole.ADMIN);
  }, [inventory, products, currentUser]);
  return (
    <div className="space-y-6" id="semi-wholesaler-dashboard">
      {/* Tabs list with Sync Indicator */}
      <DashboardTabBar
        title="Menu Demi-Grossiste - Opérations & Commandes Reçues"
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as any)}
        syncStatus={{ isOnline, pendingCount: syncQueue.length }}
        accentColor="orange"
        tabs={[
          { id: "sales_dashboard", label: "Dashboard de Vente", icon: TrendingUp },
          { id: "dashboard", label: "Tableau de Bord", icon: BarChart },
          { id: "incoming", label: "Commandes Clients Reçues", icon: FileText, badge: incomingOrders.length > 0 ? incomingOrders.length : undefined, highlight: incomingOrders.length > 0 },
          { id: "procure", label: "S'approvisionner", icon: ShoppingCart },
          { id: "purchases", label: "Mes Achats Grossiste", icon: ShoppingCart },
          { id: "pos", label: "Vente POS", icon: Zap },
          { id: "inventory", label: "Gérer Stock", icon: Package },
          { id: "accounting", label: "Comptabilité", icon: Wallet },
          { id: "clients", label: "Clients & Adresses", icon: BookOpen },
          { id: "reviews", label: "Avis Partenaires", icon: MessageSquare },
          { id: "sync", label: "Sync", icon: Cloud, badge: syncQueue.length > 0 ? syncQueue.length : undefined },
          { id: "buyers", label: "Mes Acheteurs", icon: Users },
        ]}
      />
      {activeTab === "buyers" && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-150 dark:border-zinc-800">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Mes Acheteurs & Crédits</h4>
            <p className="text-[11px] text-zinc-500 mt-1">Identifiez clairement vos acheteurs (partenaires et locaux), suivez leurs volumes d'achats cumulés et gérez leurs encours de crédit (ardoises).</p>
          </div>
          <MyBuyersModule
            connections={connections}
            currentUser={currentUser}
            users={users}
            orders={orders}
            payments={payments}
            lightClients={lightClients}
            products={products}
            onAddPayment={onAddPayment}
            onUpdateCreditLimit={onUpdateCreditLimit}
            onCreateLightClient={onCreateLightClient}
          />
        </div>
      )}
      {activeTab === "sales_dashboard" && (
        <div className="animate-fade-in">
          <MerchantSalesDashboard
            orders={orders}
            products={products}
            currentUser={currentUser}
            onUpdateOrderStatus={onUpdateOrderStatus}
            onPlaceSale={onPlaceSale}
          />
        </div>
      )}
      {/* Tab: Dashboard */}
      {activeTab === "dashboard" && (
        <div className="space-y-6 animate-fade-in">
          <ExpirationAlertsBanner alerts={semiWholesalerExpirationAlerts} />
          <ThirtyDaySalesAndStockChart
            orders={orders}
            inventory={inventory}
            products={products}
            stockMovements={stockMovements}
            currentUserId={currentUser.id}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Inventory & Alerts (Takes 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick summary card for Incoming Orders */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-xs uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" /> Commandes Clients Reçues ({incomingOrders.length})
                </h4>
                <button
                  onClick={() => setActiveTab("incoming")}
                  className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Gérer tout ({incomingOrders.length}) &rarr;
                </button>
              </div>
              {incomingOrders.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center italic">Aucune commande cliente reçue pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {incomingOrders.slice(0, 4).map((order) => {
                    const buyerObj = users.find((u) => u.id === order.senderId);
                    return (
                      <div key={order.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center justify-between border border-zinc-100 dark:border-zinc-800">
                        <div>
                          <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                            {buyerObj?.companyName || buyerObj?.name || "Client Particulier"} ({order.orderType === "B2B_SG2R" ? "Détaillant B2B" : "Client Particulier B2C"})
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            N° {order.id} • {new Date(order.createdAt).toLocaleDateString('fr-FR')} • <span className="font-bold text-amber-600">{order.status}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-600">{formatCFA(order.totalAmount)}</span>
                          <button
                            onClick={() => handleDownloadOrderPDF(order, products)}
                            className="px-2 py-1 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-[10px] font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                            title="Télécharger Facture PDF"
                          >
                            <FileText className="w-3 h-3 text-emerald-600" /> Facture PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <LowStockAlerts inventory={inventory} products={products}
             currentUserId={currentUser.id} />
          </div>
          {/* Right Column: Alerts & Notifications */}
          <div className="space-y-6">
            {/* Stock Alerts Panel */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-xs uppercase text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-orange-500" /> Alertes de stock
                </h4>
                <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {activeAlerts.length} alerte(s)
                </span>
              </div>
              {activeAlerts.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 text-xs">
                  Aucune rupture ou stock critique détecté ! Votre entrepôt est paré.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.slice(0, 5).map((item) => {
                    const prod = products.find((p) => p.id === item.productId);
                    return (
                      <div key={item.id} className="p-3 bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/30 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <img loading="lazy" src={prod?.image} alt={prod?.name} className="w-8 h-8 rounded object-cover" />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">{prod?.name}</p>
                            <p className="text-[10px] text-zinc-500">Seuil: {item.threshold}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-xs ${item.stock === 0 ? "text-rose-600 animate-pulse" : "text-amber-600"}`}>
                            {item.stock === 0 ? "Rupture" : `${item.stock} u`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Notifications */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4">
              <h4 className="font-bold text-xs uppercase text-zinc-900 dark:text-zinc-100 tracking-wider mb-4 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-indigo-500" /> Notifications
              </h4>
              <div className="space-y-3">
                <div className="p-3 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl">
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mb-1">Livraison en approche</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">Votre commande de réapprovisionnement arrive dans 30 min.</p>
                </div>
                <div className="p-3 border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">Synchronisation réussie</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">Vos ventes locales ont été synchronisées avec succès.</p>
                </div>
              </div>
            </div>
          </div>
          {/* Favorites Section */}
          {onSelectProduct && (
            <div className="lg:col-span-3 mt-4">
              <FavoritesSection
                favoriteIds={favoriteProductIds}
                products={products}
                inventory={inventory}
                onSelectProduct={onSelectProduct}
              />
            </div>
          )}
        </div>
      </div>
      )}
      {/* Tab: Procure from Wholesalers */}
      {activeTab === "procure" && (
        <div className="space-y-6 animate-fade-in">
          <SupplierSelector
            connections={connections}
            orders={orders}
            currentUser={currentUser}
            users={users}
            lightClients={lightClients}
            selectedSupplierId={selectedWholesaler}
            onSelectSupplier={(id) => {
              setSelectedWholesaler(id);
              setProcureCart({});
            }}
            onCreateLightClient={onCreateLightClient}
            targetRoles={[UserRole.WHOLESALER, UserRole.MANUFACTURER, UserRole.SEMI_WHOLESALER]}
            title="S'approvisionner : Achat auprès des Grossistes, Usines & Demi-Grossistes"
            description="Choisissez un fournisseur dans votre carnet d'adresses ou entrez son numéro de téléphone / email."
          />
          {selectedWholesaler && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">Tarifs de gros disponibles</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {products
                    .map((prod) => {
                      const invItem = inventory.find((i) => i.productId === prod.id && i.ownerId === selectedWholesaler);
                      const stock = invItem ? invItem.stock : 999;
                      const price = invItem?.price || invItem?.prixGros || prod.prixGros || prod.prixDetail || (prod as any).price || 1000;
                      return (
                        <div key={prod.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-xl flex items-center justify-between shadow-xs">
                          <div className="flex gap-2 items-center min-w-0">
                            <img loading="lazy" src={prod.image} alt={prod.name} className="w-10 h-10 rounded object-cover" />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-zinc-950 dark:text-white truncate">{prod.name}</p>
                              <p className="text-[9px] text-zinc-500">Colisage: {prod.unit} • En stock: {stock}</p>
                              <p className="text-xs font-bold text-emerald-600 font-mono mt-0.5">{formatCFA(price)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleAddToCartProcure(prod.id, -1)}
                              disabled={!procureCart[prod.id]}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold">{procureCart[prod.id] || 0}</span>
                            <button
                              onClick={() => handleAddToCartProcure(prod.id, 1)}
                              className="w-6 h-6 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-xs font-bold text-emerald-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              {/* Basket */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 rounded-2xl h-fit space-y-4 text-xs">
                <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Bon d'Approvisionnement</h5>
                <div className="space-y-2">
                  {Object.keys(procureCart)
                    .filter((prodId) => procureCart[prodId] > 0)
                    .map((prodId) => {
                      const qty = procureCart[prodId];
                      const prod = products.find((p) => p.id === prodId);
                      const invItem = inventory.find((i) => i.productId === prodId && i.ownerId === selectedWholesaler);
                      const unitPrice = invItem?.price || invItem?.prixGros || prod?.prixGros || prod?.prixDetail || (prod as any)?.price || 1000;
                      return (
                        <div key={prodId} className="flex justify-between items-center text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="truncate max-w-[120px]">{prod?.name}</span>
                          <span className="font-mono">{qty} x {formatCFA(unitPrice)}</span>
                        </div>
                      );
                    })}
                </div>
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center font-bold">
                  <span>TOTAL ESTIMÉ</span>
                  <span className="font-mono text-emerald-600">
                    {formatCFA(
                      Object.keys(procureCart)
                        .filter((id) => procureCart[id] > 0)
                        .reduce((sum, id) => {
                          const prod = products.find((p) => p.id === id);
                          const item = inventory.find((i) => i.productId === id && i.ownerId === selectedWholesaler);
                          const unitPrice = item?.price || item?.prixGros || prod?.prixGros || prod?.prixDetail || (prod as any)?.price || 1000;
                          return sum + unitPrice * procureCart[id];
                        }, 0)
                    )}
                  </span>
                </div>
                <button
                  onClick={handleCheckoutProcure}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-xl text-xs font-bold transition"
                >
                  Valider la commande B2B
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Tab: Track purchases */}
      {activeTab === "purchases" && (
        <div className="space-y-4 animate-fade-in">
          <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Mes Approvisionnements (Chaîne Grossiste)</h4>
          {myPurchases.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Aucune commande d'achat passée pour l'instant.</p>
          ) : (
            <div className="space-y-3">
              {myPurchases.map((order) => {
                const supplierObj = users.find((u) => u.id === order.receiverId);
                return (
                  <div key={order.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-xs text-orange-600">{order.id}</span>
                        <p className="text-[10px] text-zinc-500 font-medium">Fournisseur : {supplierObj?.companyName}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === OrderStatus.DELIVERED ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-600"
                      }`}>
                        Statut: {order.status}
                      </span>
                    </div>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 space-y-1">
                      {order.items.map((i, idx) => {
                        const prod = products.find((p) => p.id === i.productId);
                        return (
                          <div key={i.productId + '_' + idx} className="flex justify-between text-[11px] text-zinc-500">
                            <span>{prod?.name}</span>
                            <span>{i.quantity} x {formatCFA(i.priceAtOrder)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center text-xs pt-2 font-bold">
                      <span>Total payé/dû :</span>
                      <span className="font-mono text-emerald-600">{formatCFA(order.totalAmount)}</span>
                    </div>
                    {/* Order tracking claim logic */}
                    <div className="pt-2">
                      <OrderClaimAndConfirm
                        orderId={order.id}
                        status={order.status}
                        onConfirmReceipt={() => onUpdateOrderStatus(order.id, OrderStatus.DELIVERED)}
                        order={order}
                        products={products}
                        users={users}
                      />
                    </div>
                    {order.paymentStatus === "PENDING" && onPayOrder && (
                      <button
                        onClick={() => {
                          onPayOrder(order.id);
                          alert("Paiement effectué pour la commande " + order.id);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] py-1.5 rounded-lg font-bold transition"
                      >
                        Payer la facture (Règlement Orange/Wave)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Tab: Incoming Orders */}
      {activeTab === "incoming" && (
        <div className="space-y-4 animate-fade-in bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
          {sortedDisplayedIncomingOrders.length === 0 ? (
            <WidgetGrid
              title="Commandes Clients Reçues"
              subtitle="Cliquez sur une commande pour l'étendre sur 2 colonnes et afficher la liste détaillée des produits."
              icon={<ShoppingBag className="w-4 h-4 text-emerald-600" />}
              count={0}
              sortOrder={orderSortOrder}
              onSortChange={setOrderSortOrder}
              filterControls={
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setOrderFilterMode("active_only")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderFilterMode === "active_only"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                    title="Masque les commandes archivées"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Actives ({activeIncomingOrders.length})</span>
                  </button>
                  <button
                    onClick={() => setOrderFilterMode("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderFilterMode === "all"
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                  >
                    <span>Toutes ({incomingOrders.length})</span>
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
                    <span>Archives ({archivedIncomingOrders.length})</span>
                  </button>
                </div>
              }
              minChildWidth="300px"
            >
              <div className="col-span-full p-8 text-center bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold">
                  {orderFilterMode === "active_only" && "Aucune commande active reçue."}
                  {orderFilterMode === "archived" && "Aucune commande dans la vue archivée."}
                  {orderFilterMode === "all" && "Aucune commande enregistrée."}
                </p>
              </div>
            </WidgetGrid>
          ) : (
            <WidgetGrid 
              title="Commandes Clients Reçues"
              subtitle="Cliquez sur une commande pour l'étendre sur 2 colonnes et afficher la liste détaillée des produits."
              icon={<ShoppingBag className="w-4 h-4 text-emerald-600" />}
              count={sortedDisplayedIncomingOrders.length}
              sortOrder={orderSortOrder}
              onSortChange={setOrderSortOrder}
              onClearAll={handleClearAllIncomingOrders}
              filterControls={
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setOrderFilterMode("active_only")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderFilterMode === "active_only"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                    title="Masque les commandes archivées"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Actives ({activeIncomingOrders.length})</span>
                  </button>
                  <button
                    onClick={() => setOrderFilterMode("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      orderFilterMode === "all"
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                  >
                    <span>Toutes ({incomingOrders.length})</span>
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
                    <span>Archives ({archivedIncomingOrders.length})</span>
                  </button>
                </div>
              }
              minChildWidth="300px"
            >
              {sortedDisplayedIncomingOrders.map((order) => {
                const buyerObj = users.find((u) => u.id === order.senderId);
                const assignedDriverObj = users.find((u) => u.id === order.driverId);
                const isArchived = archivedOrderIds.includes(order.id);
                return (
                  <OrderWidgetCard
                    key={order.id}
                    order={order}
                    products={products}
                    users={users}
                    onUpdateOrderStatus={onUpdateOrderStatus}
                    onArchiveOrder={toggleArchiveOrder}
                    onDownloadPDF={handleDownloadOrderPDF}
                    onDiagnoseDelivery={handleDiagnoseDelivery}
                    isArchived={isArchived}
                  />
                );
              })}
            </WidgetGrid>
          )}
        </div>
      )}
      {activeTab === "pos" && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-150 dark:border-zinc-800">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Caisse Minute - Vente POS</h4>
            <p className="text-[11px] text-zinc-500 mt-1">Sélectionnez les produits de votre stock de demi-gros, ajustez les quantités et facturez en gros ou détail.</p>
          </div>
          <CaisseModule
            currentUser={currentUser}
            inventory={myInventory}
            products={products}
            lightClients={lightClients}
            users={users}
            orders={orders}
            payments={payments}
            onPlaceSale={onPlaceSale}
          />
        </div>
      )}
      {activeTab === "inventory" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Catalogue & Stocks de Demi-Gros</h4>
            <button
              onClick={() => {
                setIsAdding(!isAdding);
                setSelectedProdId("");
              }}
              className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-500/20"
            >
              <Plus className="w-4 h-4" /> {isAdding ? "Fermer" : "Gérer mon Catalogue"}
            </button>
          </div>
          {isAdding && (
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-4 animate-fade-in text-xs">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold uppercase text-[10px]">Rechercher ou Saisir un produit</label>
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-semibold"
                  >
                    <option value="">-- Sélectionner un produit du réseau --</option>
                    <option value="__NEW__">➕ Nouveau produit (N'existe pas dans la liste)</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                    ))}
                  </select>
                </div>
                {selectedProdId && selectedProdId !== "__NEW__" && (
                  <div className="flex-none">
                     {(() => {
                       const p = products.find(prod => prod.id === selectedProdId);
                       return p ? <img src={p.image} className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" alt="" /> : null;
                     })()}
                  </div>
                )}
              </div>
              {(selectedProdId === "__NEW__" || (selectedProdId && selectedProdId !== "__NEW__")) && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    if (selectedProdId === "__NEW__") {
                      let finalImage = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300";
                      if (uploadMode === "file") {
                        if (uploadedImage) finalImage = uploadedImage;
                      } else {
                        const urlImg = fd.get("image") as string;
                        if (urlImg) finalImage = urlImg;
                        else if (uploadedImage && uploadedImage.startsWith("http")) finalImage = uploadedImage;
                      }
                      const p = {
                        name: fd.get("name") as string,
                        description: fd.get("description") as string,
                        category: fd.get("category") as string,
                        brand: fd.get("brand") as string,
                        unit: fd.get("unit") as string,
                        weight: parseFloat(fd.get("weight") as string) || 0,
                        volume: parseFloat(fd.get("volume") as string) || 0,
                        image: finalImage,
                        barcode: Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
                        qrCode: `QR_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                      };
                      onCreateProduct(p, parseInt(fd.get("stock") as string), parseFloat(fd.get("price") as string));
                    } else {
                      const existingProd = products.find(p => p.id === selectedProdId);
                      if (existingProd) {
                        const stock = parseInt(fd.get("stock") as string) || 0;
                        const price = parseFloat(fd.get("price") as string) || 0;
                        const existingInv = myInventory.find(i => i.productId === selectedProdId);
                        if (existingInv) {
                          onUpdateInventory(existingInv.id, existingInv.stock + stock, price, price, price, 1, selectedProdId);
                        } else {
                          onUpdateInventory("", stock, price, price, price, 1, selectedProdId);
                        }
                      }
                    }
                    setIsAdding(false);
                    setSelectedProdId("");
                    setUploadedImage("");
                    alert("Produit ajouté à votre catalogue !");
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in"
                >
                  {selectedProdId === "__NEW__" ? (
                    <>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Nom du produit</label>
                          <input required name="name" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                        </div>
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Description</label>
                          <textarea required name="description" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl h-20" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Catégorie</label>
                            {!isCustomSemiWholesalerCategory ? (
                              <div className="relative">
                                <select
                                  value={PREDEFINED_CATEGORIES.includes(semiWholesalerCategory) ? semiWholesalerCategory : "AUTRE"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "AUTRE") {
                                      setIsCustomSemiWholesalerCategory(true);
                                      setSemiWholesalerCategory("");
                                    } else {
                                      setSemiWholesalerCategory(val);
                                    }
                                  }}
                                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white appearance-none pr-8 cursor-pointer font-medium text-xs"
                                >
                                  {PREDEFINED_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                  <option value="AUTRE">➕ Autre (saisir manuellement)...</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-[9px]">
                                  ▼
                                </div>
                                <input type="hidden" name="category" value={semiWholesalerCategory} />
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  required
                                  autoFocus
                                  value={semiWholesalerCategory}
                                  onChange={(e) => setSemiWholesalerCategory(e.target.value)}
                                  placeholder="Saisir la catégorie..."
                                  className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium text-xs"
                                  name="category"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCustomSemiWholesalerCategory(false);
                                    setSemiWholesalerCategory("Alimentation");
                                  }}
                                  className="px-2.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold transition text-[10px]"
                                >
                                  Retour
                                </button>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Marque</label>
                            <input required name="brand" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Unité</label>
                            <input required name="unit" placeholder="Carton / Sac" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Poids (kg)</label>
                            <input required type="number" step="0.1" name="weight" defaultValue="1" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                          <div>
                            <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Vol (m³)</label>
                            <input required type="number" step="0.01" name="volume" defaultValue="0.01" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-semibold">Illustration du Produit</label>
                          <div className="flex gap-2 p-1 bg-zinc-150 dark:bg-zinc-800 rounded-lg text-[10px] font-bold mb-2">
                            <button
                              type="button"
                              onClick={() => setUploadMode("file")}
                              className={`flex-1 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1 ${uploadMode === "file" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-850"}`}
                            >
                              <Upload className="w-3.5 h-3.5" /> Fichier
                            </button>
                            <button
                              type="button"
                              onClick={() => setUploadMode("url")}
                              className={`flex-1 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1 ${uploadMode === "url" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-850"}`}
                            >
                              <LinkIcon className="w-3.5 h-3.5" /> URL
                            </button>
                          </div>
                          {uploadMode === "file" ? (
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition duration-200 flex flex-col items-center justify-center min-h-[100px] ${
                                isDragging
                                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600"
                                  : "border-zinc-300 dark:border-zinc-700 hover:border-orange-400 bg-white dark:bg-zinc-800/50"
                              }`}
                            >
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                              />
                              {uploadedImage && !uploadedImage.startsWith("http") ? (
                                <div className="space-y-1 w-full flex flex-col items-center">
                                  <img loading="lazy" src={uploadedImage} alt="Preview" className="h-12 w-12 object-cover rounded-lg shadow-xs border border-zinc-200 dark:border-zinc-700" />
                                  <span className="text-[10px] text-zinc-500 font-medium">Cliquer pour changer</span>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Upload className="w-5 h-5 text-zinc-400 mx-auto" />
                                  <p className="text-[10px] text-zinc-500">Glissez ou parcourez</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <input
                              type="url"
                              name="image"
                              placeholder="Lien de l'image (Unsplash...)"
                              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs"
                            />
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30 flex items-center gap-4">
                      <div className="bg-white dark:bg-zinc-800 p-2 rounded-lg">
                        <Package className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-bold text-orange-900 dark:text-orange-400">Configuration Stock Demi-Gros</p>
                        <p className="text-[10px] text-orange-700 dark:text-orange-500 mt-0.5">Ajout de <strong>{products.find(p => p.id === selectedProdId)?.name}</strong> à votre catalogue.</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 md:col-span-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold uppercase text-[10px]">Quantité Entrée</label>
                      <input required name="stock" type="number" defaultValue="10" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono text-sm" />
                    </div>
                    <div>
                      <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-bold uppercase text-[10px]">Prix d'Achat/Base (FCFA)</label>
                      <input required name="price" type="number" defaultValue="1000" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono text-sm" />
                    </div>
                  </div>
                  <div className="md:col-span-2 pt-2">
                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2">
                      <Save className="w-4 h-4" /> {selectedProdId === "__NEW__" ? "Créer et Ajouter" : "Ajouter au Catalogue"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          <StockCategoryOrganizer
            inventory={inventory}
            products={products}
            currentUserId={currentUser.id}
            onUpdateInventory={onUpdateInventory}
            onDeleteInventoryItem={onDeleteInventoryItem}
            onEditProduct={(product, inventoryItem) => setEditingModalItem({ product, inventoryItem })}
            onOpenAddModal={() => setIsAdding(true)}
            onExportCSV={() => handleExportInventoryCSV(inventory, products, currentUser.id)}
            title="Catalogue & Stocks de Demi-Gros par Catégorie"
            role={currentUser.role}
          />
        </div>
      )}
      {activeTab === "clients" && (
        <div className="animate-fade-in">
          <ClientManagement 
            clients={lightClients}
            orders={orders}
            payments={payments}
            onCreateClient={onCreateLightClient}
            onDeleteClient={onDeleteLightClient}
            onAddPayment={onAddPayment}
            currentUserRole={currentUser.role}
            currentUser={currentUser}
            users={users}
            products={products}
            inventory={inventory}
          />
        </div>
      )}
      {activeTab === "sync" && (
        <div className="animate-fade-in">
          <SyncHistory queue={syncQueue} />
        </div>
      )}
      {activeTab === "accounting" && (
        <div className="animate-fade-in">
          <AccountingDashboard currentUserId={currentUser.id} orders={orders} />
        </div>
      )}
      {activeTab === "reviews" && (
        <div className="animate-fade-in">
          <PartnerReviewsSection
            connections={connections}
            currentUser={currentUser}
            users={users}
          />
        </div>
      )}
      {/* Edit Product & Stock Modal */}
      <EditProductStockModal
        isOpen={!!editingModalItem}
        onClose={() => setEditingModalItem(null)}
        product={editingModalItem?.product || null}
        inventoryItem={editingModalItem?.inventoryItem || null}
        onDelete={(itemId) => {
          onDeleteInventoryItem(itemId);
          setEditingModalItem(null);
        }}
        onSave={(productId, productData, inventoryItemId, inventoryData) => {
          if (onUpdateProductFull) {
            onUpdateProductFull(productId, productData, inventoryItemId, inventoryData);
          } else {
            onUpdateInventory(
              inventoryItemId || "",
              inventoryData?.stock || 0,
              inventoryData?.price || 0,
              inventoryData?.prixGros,
              inventoryData?.prixDetail,
              inventoryData?.quantiteMinimum,
              productId
            );
          }
          setEditingModalItem(null);
        }}
      />
    </div>
  );
}
