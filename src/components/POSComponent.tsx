import React, { useState } from "react";
import { Search, ShoppingBag, Plus } from "lucide-react";
import { Product, InventoryItem, LightClient } from "../types";
import { formatCFA } from "../data";

interface POSComponentProps {
  inventory: InventoryItem[];
  products: Product[];
  lightClients: LightClient[];
  posCart: Record<string, number>;
  onAddToCart: (prodId: string, qty: number) => void;
  onCheckout: () => void;
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  posCustomerType?: "RETAILER" | "CLIENT" | "LIGHT_CLIENT";
  setPosCustomerType?: (type: "RETAILER" | "CLIENT" | "LIGHT_CLIENT") => void;
  amountPaid: number;
  setAmountPaid: (amt: number) => void;
  title?: string;
}

export function POSComponent({
  inventory,
  products,
  lightClients,
  posCart,
  onAddToCart,
  onCheckout,
  selectedClientId,
  setSelectedClientId,
  posCustomerType = "RETAILER",
  setPosCustomerType = () => {},
  amountPaid,
  setAmountPaid,
  title = "Point de Vente Comptoir Direct"
}: POSComponentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const totalAmount = Object.keys(posCart).reduce((sum, id) => {
    const invItem = inventory.find(i => i.productId === id);
    return sum + (invItem?.price || 0) * posCart[id];
  }, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">{title}</h4>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Rechercher un produit en stock..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 transition shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
          {inventory
            .filter(item => {
              const prod = products.find(p => p.id === item.productId);
              return prod?.name.toLowerCase().includes(searchQuery.toLowerCase());
            })
            .map((item) => {
            const prod = products.find((p) => p.id === item.productId);
            if (!prod) return null;
            return (
              <div key={item.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-xl flex items-center justify-between shadow-xs hover:border-emerald-200 dark:hover:border-emerald-900/30 transition-colors">
                <div className="flex gap-3 items-center min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                    <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[11px] text-zinc-950 dark:text-white truncate">{prod.name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">Dispo: {item.stock}</p>
                    <p className="text-[11px] font-bold text-emerald-600 mt-0.5">{formatCFA(item.price)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950/50 p-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => onAddToCart(prod.id, -1)}
                    className="w-7 h-7 rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all active:scale-95 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-zinc-900 dark:text-white">{posCart[prod.id] || 0}</span>
                  <button
                    onClick={() => onAddToCart(prod.id, 1)}
                    className="w-7 h-7 rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all active:scale-95 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" /> Ticket de Caisse
            </h5>
            <span className="text-[10px] text-zinc-400 font-mono">#{new Date().getTime().toString().slice(-6)}</span>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-none">
            {Object.keys(posCart).filter(id => posCart[id] > 0).length === 0 ? (
              <div className="py-6 text-center text-zinc-400 italic text-[11px]">Le panier est vide.</div>
            ) : (
              Object.keys(posCart)
                .filter((prodId) => posCart[prodId] > 0)
                .map((prodId) => {
                  const qty = posCart[prodId];
                  const prod = products.find((p) => p.id === prodId);
                  const invItem = inventory.find((i) => i.productId === prodId);
                  return (
                    <div key={prodId} className="flex justify-between items-start text-[11px]">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{prod?.name}</p>
                        <p className="text-[10px] text-zinc-400">{qty} x {formatCFA(invItem?.price || 0)}</p>
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white whitespace-nowrap">{formatCFA((invItem?.price || 0) * qty)}</span>
                    </div>
                  );
                })
            )}
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Type de Client</label>
              <select 
                value={posCustomerType}
                onChange={(e) => setPosCustomerType(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 transition"
              >
                <option value="RETAILER">Détaillant</option>
                <option value="CLIENT">Client</option>
                <option value="LIGHT_CLIENT">Client Crédit</option>
              </select>
            </div>
            {posCustomerType === "LIGHT_CLIENT" && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Client (Crédit)</label>
              <select 
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 transition"
              >
                <option value="">Sélectionner un client...</option>
                {lightClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Montant Reçu (CFA)</label>
                <button 
                  onClick={() => setAmountPaid(totalAmount)}
                  className="text-[10px] text-emerald-600 font-bold hover:underline"
                >
                  Tout encaisser
                </button>
              </div>
              <input 
                type="number"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-emerald-500 transition"
                placeholder="0"
              />
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">TOTAL À PAYER</span>
                <span className="text-sm font-black text-emerald-900 dark:text-emerald-200 font-mono">{formatCFA(totalAmount)}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              disabled={Object.keys(posCart).filter(id => posCart[id] > 0).length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Enregistrer la vente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
