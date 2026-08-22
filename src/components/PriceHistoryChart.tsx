import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { formatCFA } from "../data";

export function PriceHistoryChart({ basePrice, buyingPrice }: { basePrice: number; buyingPrice?: number }) {
  const data = useMemo(() => {
    const now = new Date();
    const history = [];
    const sellingBase = basePrice || 5000;
    const buyingBase = buyingPrice || Math.round(sellingBase * 0.75);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      history.push({
        date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        prixAchat: buyingBase,
        prixVente: sellingBase,
      });
    }
    return history;
  }, [basePrice, buyingPrice]);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Évolution des Prix (30 derniers jours)
        </h5>
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Prix Vente
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" /> Prix Achat
          </span>
        </div>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.6} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={(val) => `${Math.round(val/1000)}k`} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-zinc-900 text-white p-2 rounded-lg text-[11px] space-y-1 shadow-lg border border-zinc-800">
                      <p className="font-bold border-b border-zinc-800 pb-1">{d.date}</p>
                      <p className="text-emerald-400">Prix Vente: {formatCFA(d.prixVente)}</p>
                      <p className="text-amber-400">Prix Achat: {formatCFA(d.prixAchat)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line type="monotone" dataKey="prixAchat" name="Prix Achat" stroke="#d97706" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
            <Line type="monotone" dataKey="prixVente" name="Prix Vente" stroke="#059669" strokeWidth={2.5} dot={{ r: 2, fill: "#059669" }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
