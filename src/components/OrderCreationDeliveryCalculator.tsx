import React, { useState, useEffect } from "react";
import { Truck, MapPin, Clock, Calculator, HelpCircle } from "lucide-react";
import { estimateShipping, formatCFA, REGION_COORDINATES } from "../data";

interface OrderCreationDeliveryCalculatorProps {
  sellerRegion: string;
  buyerRegion: string;
  onCalculateFee: (fee: number, distance: number, timeMins: number, buyerRegion: string) => void;
  title?: string;
  editableRegions?: boolean;
}

export const OrderCreationDeliveryCalculator: React.FC<OrderCreationDeliveryCalculatorProps> = ({
  sellerRegion,
  buyerRegion: initialBuyerRegion,
  onCalculateFee,
  title = "Calculateur de Livraison Intégré",
  editableRegions = true,
}) => {
  const [selectedSeller, setSelectedSeller] = useState(sellerRegion || "Abidjan");
  const [selectedBuyer, setSelectedBuyer] = useState(initialBuyerRegion || "Cocody");
  const [shippingInfo, setShippingInfo] = useState({ distance: 0, time: 0, fee: 0 });

  const regionsList = Object.keys(REGION_COORDINATES);

  // Keep state in sync if props change
  useEffect(() => {
    if (sellerRegion) setSelectedSeller(sellerRegion);
  }, [sellerRegion]);

  useEffect(() => {
    if (initialBuyerRegion) setSelectedBuyer(initialBuyerRegion);
  }, [initialBuyerRegion]);

  // Recalculate shipping whenever seller or buyer region changes
  useEffect(() => {
    const info = estimateShipping(selectedSeller, selectedBuyer);
    setShippingInfo(info);
    onCalculateFee(info.fee, info.distance, info.time, selectedBuyer);
  }, [selectedSeller, selectedBuyer]);

  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-150 dark:border-zinc-850 rounded-2xl space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-zinc-950 dark:text-white font-bold text-xs uppercase tracking-wider">
          <Truck className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span>{title}</span>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono">Distance-based ETA</span>
      </div>

      {editableRegions ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Adresse de départ (Vendeur)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
              </span>
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {regionsList.map((region) => (
                  <option key={`seller-${region}`} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Destination finale (Acheteur)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              </span>
              <select
                value={selectedBuyer}
                onChange={(e) => setSelectedBuyer(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {regionsList.map((region) => (
                  <option key={`buyer-${region}`} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800/40 p-2 rounded-xl text-[11px] text-zinc-600 dark:text-zinc-400">
          <span>De <strong>{selectedSeller}</strong> à <strong>{selectedBuyer}</strong></span>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-bold">Auto</span>
        </div>
      )}

      {/* Metrics breakdown */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="bg-white dark:bg-zinc-800 p-2 rounded-xl border border-zinc-150 dark:border-zinc-800 text-center space-y-0.5">
          <p className="text-[9px] font-bold text-zinc-400 uppercase">Distance</p>
          <div className="text-xs font-bold text-zinc-900 dark:text-white font-mono flex items-center justify-center gap-0.5">
            <span>{shippingInfo.distance}</span>
            <span className="text-[10px] font-normal text-zinc-500">km</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-2 rounded-xl border border-zinc-150 dark:border-zinc-800 text-center space-y-0.5">
          <p className="text-[9px] font-bold text-zinc-400 uppercase">Temps Estimé</p>
          <div className="text-xs font-bold text-zinc-900 dark:text-white font-mono flex items-center justify-center gap-0.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400 inline" />
            <span>{shippingInfo.time}</span>
            <span className="text-[10px] font-normal text-zinc-500">m</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-2 rounded-xl border border-zinc-150 dark:border-zinc-800 text-center space-y-0.5">
          <p className="text-[9px] font-bold text-zinc-400 uppercase">Frais Estimé</p>
          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCFA(shippingInfo.fee)}
          </div>
        </div>
      </div>
    </div>
  );
};
