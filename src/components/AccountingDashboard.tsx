import React, { useState, useEffect, useMemo } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Plus, 
  Calendar, 
  FileText, 
  Wallet, 
  Receipt,
  AlertCircle,
  CheckCircle2,
  X
} from "lucide-react";
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
import { Order } from "../types";
import { formatCFA } from "../data";
import { db } from "../firebase/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from "firebase/firestore";

interface AccountingDashboardProps {
  currentUserId: string;
  orders: Order[];
}

interface Expense {
  id: string;
  categorie: string;
  montant: number;
  description: string;
  date: string;
}

export const AccountingDashboard: React.FC<AccountingDashboardProps> = ({ currentUserId, orders }) => {
  const [period, setPeriod] = useState<"jour" | "semaine" | "mois" | "annee">("mois");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newCat, setNewCat] = useState("Loyer");
  const [newAmount, setNewAmount] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  // Écoute en temps réel de Firestore pour les dépenses de l'utilisateur
  useEffect(() => {
    if (!currentUserId) return;
    const q = query(collection(db, "comptabilite", currentUserId, "depenses"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Expense[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          list.push(docSnap.data() as Expense);
        }
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(list);
    }, (err) => {
      console.warn("Notice: Firestore comptabilite listener:", err);
    });

    return () => unsub();
  }, [currentUserId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newAmount);
    if (!amountNum || amountNum <= 0 || !currentUserId) return;

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      categorie: newCat,
      montant: amountNum,
      description: newDesc || "Dépense diverse",
      date: newDate
    };

    try {
      await setDoc(doc(db, "comptabilite", currentUserId, "depenses", newExp.id), newExp);
      setIsExpenseModalOpen(false);
      setNewAmount("");
      setNewDesc("");
      setNewDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      console.error("Erreur enregistrement dépense Firestore:", err);
    }
  };

  // Filter sales/orders based on period & user
  const filteredData = useMemo(() => {
    const now = new Date();
    
    // My sales as seller (CA & Créances)
    const mySales = orders.filter(o => 
      o.receiverId === currentUserId && 
      o.status !== "CANCELLED" && 
      o.status !== "annulee"
    );

    // My purchases as buyer (Dépenses achats)
    const myPurchases = orders.filter(o => 
      (o.senderId === currentUserId || o.clientId === currentUserId) && 
      o.status !== "CANCELLED" && 
      o.status !== "annulee"
    );

    // Filter by period
    const isInPeriod = (dateStr: string) => {
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;

      if (period === "jour") {
        return d.toDateString() === now.toDateString();
      } else if (period === "semaine") {
        const diffTime = Math.abs(now.getTime() - d.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      } else if (period === "mois") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else {
        // annee
        return d.getFullYear() === now.getFullYear();
      }
    };

    const periodSales = mySales.filter(o => isInPeriod(o.createdAt));
    const periodPurchases = myPurchases.filter(o => isInPeriod(o.createdAt));
    const periodExpenses = expenses.filter(e => isInPeriod(e.date));

    // CA
    const ca = periodSales.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Dépenses Achats + Manuelles
    const depensesAchats = periodPurchases.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const depensesManuelles = periodExpenses.reduce((sum, e) => sum + e.montant, 0);
    const totalDepenses = depensesAchats + depensesManuelles;

    // Marge = CA - Dépenses
    const marge = ca - totalDepenses;

    // Créances = ventes statut credit ou paymentStatus DEFERRED non soldées
    const creances = mySales
      .filter(o => (o.status === "credit" || o.paymentStatus === "DEFERRED" || o.paymentStatus === "PARTIAL"))
      .reduce((sum, o) => sum + Math.max(0, (o.totalAmount || 0) - (o.amountPaid || 0)), 0);

    return {
      ca,
      depensesAchats,
      depensesManuelles,
      totalDepenses,
      marge,
      creances,
      periodSales,
      periodPurchases,
      periodExpenses
    };
  }, [orders, expenses, currentUserId, period]);

  // 6 Months Chart data (CA vs Dépenses)
  const chartData = useMemo(() => {
    const result = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();

      // Month sales
      const monthSales = orders.filter(o => {
        if (o.receiverId !== currentUserId || o.status === "CANCELLED") return false;
        const od = new Date(o.createdAt);
        return !isNaN(od.getTime()) && od.getMonth() === mMonth && od.getFullYear() === mYear;
      });

      // Month purchases
      const monthPurchases = orders.filter(o => {
        if ((o.senderId !== currentUserId && o.clientId !== currentUserId) || o.status === "CANCELLED") return false;
        const od = new Date(o.createdAt);
        return !isNaN(od.getTime()) && od.getMonth() === mMonth && od.getFullYear() === mYear;
      });

      // Month manual expenses
      const monthExpenses = expenses.filter(e => {
        const ed = new Date(e.date);
        return !isNaN(ed.getTime()) && ed.getMonth() === mMonth && ed.getFullYear() === mYear;
      });

      const ca = monthSales.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const dep = monthPurchases.reduce((sum, o) => sum + (o.totalAmount || 0), 0) + 
                  monthExpenses.reduce((sum, e) => sum + e.montant, 0);

      result.push({
        name: monthName,
        CA: ca,
        Depenses: dep,
        Marge: ca - dep
      });
    }

    return result;
  }, [orders, expenses, currentUserId]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Period Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" /> Ma Comptabilité Simplifiée
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Suivi des performances financières, charges et créances en temps réel.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            {(["jour", "semaine", "mois", "annee"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition capitalize cursor-pointer ${
                  period === p 
                    ? "bg-white dark:bg-zinc-900 text-emerald-600 shadow-xs" 
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {p === "annee" ? "Année" : p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Ajouter une dépense
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CA */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Chiffre d'Affaires</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-extrabold text-zinc-950 dark:text-white">{formatCFA(filteredData.ca)}</h3>
          </div>
          <p className="text-[11px] text-zinc-500">Ventes validées sur la période</p>
        </div>

        {/* Dépenses */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Dépenses Totales</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl">
              <TrendingDown className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-extrabold text-zinc-950 dark:text-white">{formatCFA(filteredData.totalDepenses)}</h3>
          </div>
          <p className="text-[11px] text-zinc-500">Achats ({formatCFA(filteredData.depensesAchats)}) + Charges ({formatCFA(filteredData.depensesManuelles)})</p>
        </div>

        {/* Marge */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Marge Nette</span>
            <div className={`p-2 rounded-xl ${filteredData.marge >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600" : "bg-rose-50 dark:bg-rose-950/40 text-rose-600"}`}>
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-xl font-extrabold ${filteredData.marge >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
              {formatCFA(filteredData.marge)}
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500">CA - Dépenses totales</p>
        </div>

        {/* Créances */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Créances en Cours</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
              <CreditCard className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{formatCFA(filteredData.creances)}</h3>
          </div>
          <p className="text-[11px] text-zinc-500">Crédits non encore soldés</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" /> Évolution CA vs Dépenses (6 derniers mois)
            </h3>
            <p className="text-xs text-zinc-500">Comparatif mensuel des flux financiers.</p>
          </div>
          <span className="text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1 rounded-full">
            Recharts Analytics
          </span>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                formatter={(value: any) => [formatCFA(Number(value)), '']}
              />
              <Legend />
              <Line type="monotone" dataKey="CA" name="Chiffre d'Affaires" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Depenses" name="Dépenses" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Manual Expenses List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" /> Historique des Dépenses Manuelles
          </h3>
          <span className="text-xs text-zinc-500">{expenses.length} enregistrement(s)</span>
        </div>

        {expenses.length === 0 ? (
          <p className="text-xs text-zinc-400 py-6 text-center">Aucune dépense manuelle enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50">
                    <td className="p-3 text-zinc-600 dark:text-zinc-300 font-mono">{exp.date}</td>
                    <td className="p-3 font-semibold text-zinc-900 dark:text-white">{exp.categorie}</td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">{exp.description}</td>
                    <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400 font-mono">-{formatCFA(exp.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" /> Enregistrer une dépense
              </h3>
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Catégorie</label>
                <select 
                  value={newCat} 
                  onChange={(e) => setNewCat(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white"
                >
                  <option value="Loyer">Loyer</option>
                  <option value="Transport">Transport / Carburant</option>
                  <option value="Salaires">Salaires & Personnel</option>
                  <option value="Factures">Factures (Électricité, Eau, Internet)</option>
                  <option value="Fournitures">Fournitures & Emballages</option>
                  <option value="Maintenance">Maintenance & Réparations</option>
                  <option value="Divers">Divers / Autres</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Montant (FCFA)</label>
                <input 
                  type="number"
                  required
                  placeholder="Ex: 50000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description / Notes</label>
                <input 
                  type="text"
                  placeholder="Ex: Achat de matériel d'emballage"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
                <input 
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
