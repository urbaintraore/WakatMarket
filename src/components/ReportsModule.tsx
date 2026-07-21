/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Calendar, TrendingUp, DollarSign, ShoppingBag, Receipt, ArrowUpRight, BarChart2 } from "lucide-react";
import { Order, Product } from "../types";
import { formatCFA } from "../data";

interface ReportsModuleProps {
  orders: Order[];
  products: Product[];
}

export default function ReportsModule({ orders, products }: ReportsModuleProps) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");

  // Compute stats based on period
  const totalSales = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "RETURNED")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalCommissions = totalSales * 0.05; // 5% platform fee
  const deliveryCount = orders.filter((o) => o.status === "DELIVERED").length;

  // Simple dataset simulation based on periods
  const getPeriodData = () => {
    switch (period) {
      case "daily":
        return [
          { name: "Aujourd'hui", ventes: totalSales, commandes: orders.length, commission: totalCommissions },
          { name: "Hier", ventes: totalSales * 0.9, commandes: Math.max(1, orders.length - 1), commission: totalCommissions * 0.9 },
        ];
      case "weekly":
        return [
          { name: "Semaine Actuelle", ventes: totalSales * 1.2, commandes: orders.length + 3, commission: totalCommissions * 1.2 },
          { name: "Semaine Précédente", ventes: 1850000, commandes: 12, commission: 92500 },
          { name: "Il y a 2 semaines", ventes: 2200000, commandes: 15, commission: 110000 },
        ];
      case "yearly":
        return [
          { name: "Année 2026", ventes: totalSales * 8.5, commandes: orders.length * 8, commission: totalCommissions * 8.5 },
          { name: "Année 2025", ventes: 45000000, commandes: 340, commission: 2250000 },
        ];
      case "monthly":
      default:
        return [
          { name: "Juillet (En cours)", ventes: totalSales, commandes: orders.length, commission: totalCommissions },
          { name: "Juin 2026", ventes: 12450000, commandes: 85, commission: 622500 },
          { name: "Mai 2026", ventes: 10890000, commandes: 72, commission: 544500 },
          { name: "Avril 2026", ventes: 9400000, commandes: 60, commission: 470000 },
        ];
    }
  };

  const activeData = getPeriodData();

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Periode;Chiffre d Affaires (FCFA);Nombre de Commandes;Commissions Plateforme (FCFA)\n";

    activeData.forEach((row) => {
      csvContent += `${row.name};${row.ventes};${row.commandes};${row.commission}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rapport_Distribution_SupplyChain_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (represented as tab-separated spreadsheet)
  const handleExportExcel = () => {
    let excelContent = "data:application/vnd.ms-excel;charset=utf-8,";
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
  };

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const handleExportPDF = () => {
    setPdfGenerating(true);
    setTimeout(() => {
      setPdfGenerating(false);
      window.print(); // Native client side PDF/print trigger, extremely elegant!
    }, 1200);
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
      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-750 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          id="export-csv-btn"
        >
          <Download className="w-3.5 h-3.5" /> CSV Export
        </button>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-750 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          id="export-excel-btn"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel Spreadsheet
        </button>
        <button
          onClick={handleExportPDF}
          disabled={pdfGenerating}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          id="export-pdf-btn"
        >
          {pdfGenerating ? (
            <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-red-400" />
          )}
          <span>Imprimer / PDF</span>
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
