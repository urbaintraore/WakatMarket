/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Calendar, TrendingUp, DollarSign, ShoppingBag, Receipt, ArrowUpRight, BarChart2, Package, ShoppingCart, CheckCircle2, RefreshCw } from "lucide-react";
import { jsPDF } from "jspdf";
import { Order, Product, InventoryItem, UserProfile } from "../types";
import { formatCFA } from "../data";

interface ReportsModuleProps {
  orders: Order[];
  products: Product[];
  inventory?: InventoryItem[];
  currentUser?: UserProfile;
}

export default function ReportsModule({ orders, products, inventory, currentUser }: ReportsModuleProps) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Compute stats based on period
  const totalSales = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "RETURNED")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalCommissions = totalSales * 0.05; // 5% platform fee
  const deliveryCount = orders.filter((o) => o.status === "DELIVERED").length;

  // Real data aggregation based on selected period
  const getPeriodData = () => {
    const validOrders = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "RETURNED" && (o.status as string) !== "annulee");
    const now = new Date();

    const isSameDay = (d1: Date, d2: Date) => 
      d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

    const isSameMonth = (d1: Date, d2: Date) => 
      d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

    const isSameYear = (d1: Date, d2: Date) => 
      d1.getFullYear() === d2.getFullYear();

    if (period === "daily") {
      const todayOrders = validOrders.filter(o => o.createdAt && isSameDay(new Date(o.createdAt), now));
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayOrders = validOrders.filter(o => o.createdAt && isSameDay(new Date(o.createdAt), yesterday));

      const todayCA = todayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const yestCA = yesterdayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

      return [
        { name: "Aujourd'hui", ventes: todayCA, commandes: todayOrders.length, commission: todayCA * 0.05 },
        { name: "Hier", ventes: yestCA, commandes: yesterdayOrders.length, commission: yestCA * 0.05 },
      ];
    } else if (period === "weekly") {
      const thisWeekOrders = validOrders.filter(o => {
        if (!o.createdAt) return false;
        const diff = Math.abs(now.getTime() - new Date(o.createdAt).getTime());
        return diff <= 7 * 86400000;
      });
      const lastWeekOrders = validOrders.filter(o => {
        if (!o.createdAt) return false;
        const diff = now.getTime() - new Date(o.createdAt).getTime();
        return diff > 7 * 86400000 && diff <= 14 * 86400000;
      });

      const twCA = thisWeekOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const lwCA = lastWeekOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

      return [
        { name: "Semaine Actuelle", ventes: twCA, commandes: thisWeekOrders.length, commission: twCA * 0.05 },
        { name: "Semaine Précédente", ventes: lwCA, commandes: lastWeekOrders.length, commission: lwCA * 0.05 },
      ];
    } else if (period === "yearly") {
      const thisYearOrders = validOrders.filter(o => o.createdAt && isSameYear(new Date(o.createdAt), now));
      const lastYear = new Date(now.getFullYear() - 1, 0, 1);
      const lastYearOrders = validOrders.filter(o => o.createdAt && isSameYear(new Date(o.createdAt), lastYear));

      const tyCA = thisYearOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const lyCA = lastYearOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

      return [
        { name: `Année ${now.getFullYear()}`, ventes: tyCA, commandes: thisYearOrders.length, commission: tyCA * 0.05 },
        { name: `Année ${now.getFullYear() - 1}`, ventes: lyCA, commandes: lastYearOrders.length, commission: lyCA * 0.05 },
      ];
    } else { // monthly
      const months = [];
      for (let i = 0; i < 4; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mOrders = validOrders.filter(o => {
          if (!o.createdAt) return false;
          return isSameMonth(new Date(o.createdAt), d);
        });
        const ca = mOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
        const monthLabel = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        months.push({
          name: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          ventes: ca,
          commandes: mOrders.length,
          commission: ca * 0.05,
        });
      }
      return months;
    }
  };

  const activeData = getPeriodData();

  // Robust CSV Download Utility with UTF-8 BOM for Excel Compatibility
  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const processCell = (val: string | number | boolean | undefined | null) => {
      let cell = val === null || val === undefined ? "" : String(val);
      cell = cell.replace(/"/g, '""');
      if (cell.includes(";") || cell.includes("\n") || cell.includes('"')) {
        cell = `"${cell}"`;
      }
      return cell;
    };

    const csvLines = [
      headers.map(processCell).join(";"),
      ...rows.map((row) => row.map(processCell).join(";")),
    ];

    // UTF-8 BOM byte sequence ensures Excel opens French accented text correctly
    const csvContent = "\uFEFF" + csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const triggerToast = (msg: string) => {
    setExportSuccessMessage(msg);
    setTimeout(() => setExportSuccessMessage(null), 3500);
  };

  // 1. Export Inventory & Products CSV
  const handleExportInventoryCSV = () => {
    const headers = [
      "ID Article / Produit",
      "Nom du Produit",
      "Catégorie",
      "Marque",
      "Unité de Conditionnement",
      "Prix de Gros (FCFA)",
      "Prix Détail (FCFA)",
      "Code-Barres",
      "Stock Disponible",
      "Seuil d'Alerte"
    ];

    const sourceData = inventory && inventory.length > 0 ? inventory : products;

    const rows = sourceData.map((item: any) => {
      const prod = products.find((p) => p.id === (item.productId || item.id)) || (item.name ? item : null);
      const name = prod?.name || item.name || "Produit Inconnu";
      const category = prod?.category || item.category || "Général";
      const brand = prod?.brand || item.brand || "—";
      const unit = prod?.unit || item.unit || "Unité";
      const prixGros = item.prixGros || prod?.prixGros || item.price || 0;
      const prixDetail = item.prixDetail || prod?.prixDetail || item.price || 0;
      const barcode = prod?.barcode || item.barcode || "—";
      const stock = item.stock !== undefined ? item.stock : "Illimité";
      const threshold = item.threshold !== undefined ? item.threshold : (prod?.lowStockThreshold || "—");

      return [
        item.id,
        name,
        category,
        brand,
        unit,
        prixGros,
        prixDetail,
        barcode,
        stock,
        threshold
      ];
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `Export_Inventaires_${currentUser?.companyName || "Gestionnaire"}_${dateStr}.csv`;
    downloadCSV(filename, headers, rows);
    triggerToast(`Exportation de ${rows.length} article(s) de stock réussie !`);
  };

  // 2. Export Sales History CSV
  const handleExportSalesCSV = () => {
    const headers = [
      "ID Commande",
      "Date & Heure",
      "Rôle Expéditeur",
      "Rôle Destinataire",
      "Montant Total (FCFA)",
      "Statut de Commande",
      "Mode de Paiement",
      "Paiement à la Livraison",
      "Nombre d'Articles"
    ];

    const rows = orders.map((o) => {
      const itemCount = o.items ? o.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
      const dateFormatted = o.createdAt ? new Date(o.createdAt).toLocaleString("fr-FR") : "—";
      return [
        o.id,
        dateFormatted,
        o.senderId || "Anonyme",
        o.receiverId || "Client",
        o.totalAmount,
        o.status,
        o.paymentMethod || "CASH",
        o.paymentMethod === "CASH" ? "Oui" : "Non",
        itemCount
      ];
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `Export_Historique_Ventes_${currentUser?.companyName || "Gestionnaire"}_${dateStr}.csv`;
    downloadCSV(filename, headers, rows);
    triggerToast(`Exportation de ${rows.length} commande(s) enregistrée(s) réussie !`);
  };

  // 3. Export BI Summary CSV
  const handleExportCSV = () => {
    const headers = ["Période", "Chiffre d'Affaires (FCFA)", "Nombre de Commandes", "Commissions Plateforme (FCFA)"];
    const rows = activeData.map((row) => [row.name, row.ventes, row.commandes, row.commission]);
    const filename = `Rapport_BI_Synthese_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(filename, headers, rows);
    triggerToast(`Exportation de la synthèse BI (${period}) réussie !`);
  };

  // Export to Excel (tab-separated format)
  const handleExportExcel = () => {
    let excelContent = "data:application/vnd.ms-excel;charset=utf-8,\uFEFF";
    excelContent += "Période\tChiffre d'Affaires (FCFA)\tCommandes\tCommissions (FCFA)\n";

    activeData.forEach((row) => {
      excelContent += `${row.name}\t${row.ventes}\t${row.commandes}\t${row.commission}\n`;
    });

    const encodedUri = encodeURI(excelContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rapport_BI_ERP_${period}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(`Exportation Excel générée avec succès !`);
  };

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const handleExportPDF = () => {
    setPdfGenerating(true);
    try {
      const doc = new jsPDF();
      const companyName = currentUser?.companyName || "Mon Entreprise";
      const dateStr = new Date().toLocaleDateString("fr-FR");

      // Header
      doc.setFillColor(16, 185, 129); // Emerald
      doc.rect(0, 0, 210, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("WakatMarket - Bilan Comptable et Stock", 14, 18);

      // Info
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Entreprise : ${companyName}`, 14, 38);
      doc.text(`Date d'émission : ${dateStr}`, 14, 44);
      doc.text(`Période sélectionnée : ${period}`, 14, 50);

      // Summary
      doc.setFont("helvetica", "bold");
      doc.text(`Ventes Globales : ${formatCFA(totalSales)}`, 130, 38);
      doc.text(`Commandes Livrées : ${deliveryCount}`, 130, 44);

      // Table Header BI
      let y = 60;
      doc.setFontSize(12);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, y, 196, y);
      y += 8;
      doc.text("Synthèse des Ventes (Période)", 14, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Période", 14, y);
      doc.text("Commandes", 70, y);
      doc.text("Chiffre d'Affaires", 110, y);
      doc.text("Commissions", 160, y);
      y += 4;
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      activeData.forEach((row) => {
        doc.text(row.name, 14, y);
        doc.text(row.commandes.toString(), 70, y);
        doc.text(formatCFA(row.ventes), 110, y);
        doc.text(formatCFA(row.commission), 160, y);
        y += 6;
      });

      // Stock
      y += 12;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.line(14, y - 6, 196, y - 6);
      doc.text("État du Stock Actuel (Aperçu)", 14, y);
      y += 6;
      
      doc.setFontSize(9);
      doc.text("Produit", 14, y);
      doc.text("Prix Gros", 90, y);
      doc.text("Prix Détail", 130, y);
      doc.text("Stock", 170, y);
      y += 4;
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      const stockItems = inventory && inventory.length > 0 ? inventory : products;
      const topItems = stockItems.slice(0, 30);
      topItems.forEach((item: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const prod = products.find((p) => p.id === (item.productId || item.id)) || (item.name ? item : null);
        const name = (prod?.name || item.name || "Produit Inconnu").substring(0, 35);
        const prixGros = item.prixGros || prod?.prixGros || item.price || 0;
        const prixDetail = item.prixDetail || prod?.prixDetail || item.price || 0;
        const stock = item.stock !== undefined ? item.stock : "Illimité";

        doc.text(name, 14, y);
        doc.text(formatCFA(prixGros), 90, y);
        doc.text(formatCFA(prixDetail), 130, y);
        doc.text(stock.toString(), 170, y);
        y += 6;
      });

      if (stockItems.length > 30) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`+ ${stockItems.length - 30} autres articles non affichés...`, 14, y + 2);
      }

      doc.save(`Bilan_Comptable_${companyName.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`);
      triggerToast("Export PDF généré avec succès !");
    } catch (e) {
      console.error(e);
      triggerToast("Erreur lors de la génération du PDF");
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm" id="reports-module">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-zinc-950 dark:text-white">
              Rapports Décisionnels & BI
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Suivi financier, volume logistique et export de données comptables
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Period Selector Buttons */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl self-stretch sm:self-auto">
            {(["daily", "weekly", "monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition ${
                  period === p
                    ? "bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
                id={`report-period-${p}`}
              >
                {p === "daily" ? "Jour" : p === "weekly" ? "Semaine" : p === "monthly" ? "Mois" : "Année"}
              </button>
            ))}
          </div>
          
          <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-700"></div>
          
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={handleExportExcel}
              className="flex-1 sm:flex-initial flex justify-center items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
              id="export-excel-btn"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={pdfGenerating}
              className="flex-1 sm:flex-initial flex justify-center items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm"
              id="export-pdf-btn"
            >
              {pdfGenerating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 rounded-xl">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[9px] text-emerald-600 bg-emerald-100 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              +14.5% <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-3 font-medium">Chiffre d'Affaires Global</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
            {formatCFA(totalSales)}
          </p>
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 rounded-xl">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="text-[9px] text-indigo-600 bg-indigo-100 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              +8.2% <ArrowUpRight className="w-2.5 h-2.5" />
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-3 font-medium">Commandes Livrées / Total</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
            {deliveryCount} / {orders.length}
          </p>
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 rounded-xl">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-[9px] text-amber-600 bg-amber-100 dark:bg-amber-950/20 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              5% Rate
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-3 font-medium">Commission Plateforme Collectée</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
            {formatCFA(totalCommissions)}
          </p>
        </div>
      </div>

      {/* Toast Notification for Export */}
      {exportSuccessMessage && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{exportSuccessMessage}</span>
        </div>
      )}

      {/* Dedicated CSV Exports Section for Managers */}
      <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-750 pb-2.5">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-600" />
            Centre d'Exportation CSV & Téléchargements
          </h4>
          <span className="text-[10px] text-zinc-500 font-semibold">Format universel UTF-8 avec séparateurs point-virgule</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Inventory Export Card */}
          <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-zinc-900 dark:text-white">Rapport d'Inventaire & Stock</h5>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {(inventory && inventory.length > 0 ? inventory.length : products.length)} références en catalogue
                </p>
              </div>
            </div>
            <button
              onClick={handleExportInventoryCSV}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs flex-shrink-0"
              id="export-inventory-csv-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Inventaire CSV</span>
            </button>
          </div>

          {/* Sales History Export Card */}
          <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-zinc-900 dark:text-white">Historique des Ventes</h5>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {orders.length} transaction(s) de commande
                </p>
              </div>
            </div>
            <button
              onClick={handleExportSalesCSV}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs flex-shrink-0"
              id="export-sales-csv-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ventes CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Table */}
      <div className="border border-zinc-150 dark:border-zinc-800 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <th className="px-4 py-3">Période</th>
              <th className="px-4 py-3 text-right">Commandes</th>
              <th className="px-4 py-3 text-right">Chiffre d'Affaires</th>
              <th className="px-4 py-3 text-right">Commission Plateforme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
            {activeData.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-zinc-700 dark:text-zinc-300">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{row.name}</td>
                <td className="px-4 py-3 text-right font-mono">{row.commandes}</td>
                <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-white font-mono">
                  {formatCFA(row.ventes)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                  {formatCFA(row.commission)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Data Export Drawer Actions */}
      <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-750 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          id="export-csv-btn"
        >
          <Download className="w-3.5 h-3.5" /> Exporter le tableau en CSV
        </button>
      </div>
    </div>
  );
}

// Quick refresh icon helper
function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
