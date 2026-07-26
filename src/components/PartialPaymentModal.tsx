import React, { useState } from "react";
import { 
  X, DollarSign, CreditCard, Calendar, CheckCircle2, AlertCircle, 
  FileText, ArrowRight, ShieldCheck, RefreshCw 
} from "lucide-react";
import { Order } from "../types";
import { formatCFA } from "../data";

interface PartialPaymentModalProps {
  order: Order;
  buyerName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitPayment: (clientId: string, amount: number, orderId: string, method: string) => void;
}

export function PartialPaymentModal({
  order,
  buyerName,
  isOpen,
  onClose,
  onSubmitPayment
}: PartialPaymentModalProps) {
  const remainingDue = Math.max(0, order.totalAmount - order.amountPaid);
  const [amountInput, setAmountInput] = useState<string>(remainingDue.toString());
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const numericAmount = parseFloat(amountInput) || 0;
  const newAmountPaidTotal = order.amountPaid + numericAmount;
  const newRemainingDue = Math.max(0, order.totalAmount - newAmountPaidTotal);
  const isFullyPaid = newRemainingDue === 0;

  const handleQuickPercent = (pct: number) => {
    const calculated = Math.round(remainingDue * pct);
    setAmountInput(calculated.toString());
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setErrorMsg("Veuillez saisir un montant supérieur à 0 CFA.");
      return;
    }
    if (numericAmount > remainingDue) {
      setErrorMsg(`Le montant saisi (${formatCFA(numericAmount)}) dépasse le solde restant dû (${formatCFA(remainingDue)}).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const buyerId = order.clientId || order.senderId || order.receiverId;

    try {
      onSubmitPayment(buyerId, numericAmount, order.id, paymentMethod);
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error("Error submitting partial payment:", err);
      setErrorMsg("Erreur lors de l'enregistrement du règlement.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">Saisie d'un Règlement Partiel</h3>
              <p className="text-xs text-emerald-100 font-medium">Facture #{order.id.split('-').pop()?.toUpperCase()} — {buyerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto">
          
          {/* Invoice Summary Box */}
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date Facture: {new Date(order.createdAt).toLocaleDateString("fr-FR")}
              </span>
              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                {order.paymentStatus === "PARTIAL" ? "Partiellement Réglée" : "À Crédit"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
              <div>
                <p className="text-[9px] uppercase font-bold text-zinc-400">Total Facture</p>
                <p className="text-xs font-black text-zinc-900 dark:text-white font-mono">{formatCFA(order.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-zinc-400">Déjà Réglé</p>
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCFA(order.amountPaid)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-zinc-400">Reste Dû</p>
                <p className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono">{formatCFA(remainingDue)}</p>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Montants Prédéfinis
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPercent(0.25)}
                className="py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handleQuickPercent(0.5)}
                className="py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handleQuickPercent(0.75)}
                className="py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => handleQuickPercent(1.0)}
                className="py-1.5 px-2 bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Solder 100%
              </button>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-extrabold text-zinc-800 dark:text-zinc-200 mb-1">
              Montant du Règlement Partiel (CFA) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={remainingDue}
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full pl-4 pr-12 py-3 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-base font-black text-zinc-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                placeholder="Ex: 50000"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400">
                CFA
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Moyen de Paiement *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition"
            >
              <option value="CASH">Espèces (CASH)</option>
              <option value="ORANGE_MONEY">Orange Money (OM)</option>
              <option value="MOOV_MONEY">Moov Money (G-XAF / Flooz)</option>
              <option value="WAVE">Wave Mobile</option>
              <option value="CREDIT_CARD">Virement BTP / Carte Bancaire</option>
            </select>
          </div>

          {/* Live Preview Calculation */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-300 font-medium">Nouveau Solde Restant :</span>
              <span className={`font-mono font-black ${isFullyPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {formatCFA(newRemainingDue)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-300 font-medium">Statut Après Règlement :</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                isFullyPaid 
                  ? "bg-emerald-600 text-white" 
                  : "bg-amber-500 text-white"
              }`}>
                {isFullyPaid ? "SOLDE TOTALEMENT PAYÉ" : "RÈGLEMENT PARTIEL MAINTENU"}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || numericAmount <= 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wide shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider le Règlement</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
