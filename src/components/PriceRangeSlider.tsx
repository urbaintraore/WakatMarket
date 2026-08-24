import React, { useState, useEffect, useMemo } from "react";
import { DollarSign, SlidersHorizontal, RotateCcw, Tag } from "lucide-react";
import { formatCFA } from "../data";

interface PriceRangeSliderProps {
  minPrice: number;
  maxPrice: number;
  currentMin: number;
  currentMax: number;
  onChange: (range: { min: number; max: number }) => void;
  onReset?: () => void;
  matchingCount?: number;
  totalCount?: number;
  step?: number;
  className?: string;
  compact?: boolean;
}

export const PriceRangeSlider: React.FC<PriceRangeSliderProps> = ({
  minPrice,
  maxPrice,
  currentMin,
  currentMax,
  onChange,
  onReset,
  matchingCount,
  totalCount,
  step = 500,
  className = "",
  compact = false
}) => {
  const safeMin = Math.max(0, minPrice);
  const safeMax = Math.max(safeMin + 1000, maxPrice);

  const [localMin, setLocalMin] = useState(currentMin);
  const [localMax, setLocalMax] = useState(currentMax);

  useEffect(() => {
    setLocalMin(currentMin);
    setLocalMax(currentMax);
  }, [currentMin, currentMax]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), localMax - step);
    setLocalMin(val);
    onChange({ min: val, max: localMax });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), localMin + step);
    setLocalMax(val);
    onChange({ min: localMin, max: val });
  };

  const isFiltered = localMin > safeMin || localMax < safeMax;

  // Preset Price Brackets
  const presets = useMemo(() => {
    const range = safeMax - safeMin;
    if (range <= 0) return [];
    return [
      { label: "Tous", min: safeMin, max: safeMax },
      { label: "< 10 000 F", min: safeMin, max: Math.min(safeMax, 10000) },
      { label: "10k - 50k F", min: Math.max(safeMin, 10000), max: Math.min(safeMax, 50000) },
      { label: "50k - 100k F", min: Math.max(safeMin, 50000), max: Math.min(safeMax, 100000) },
      { label: "> 100k F", min: Math.max(safeMin, 100000), max: safeMax },
    ].filter(p => p.min < p.max);
  }, [safeMin, safeMax]);

  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Filtrer par tranche de prix
            </h4>
            {matchingCount !== undefined && totalCount !== undefined && (
              <p className="text-[10px] text-zinc-500 font-medium">
                {matchingCount} sur {totalCount} article(s) trouvé(s)
              </p>
            )}
          </div>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setLocalMin(safeMin);
              setLocalMax(safeMax);
              if (onReset) onReset();
              else onChange({ min: safeMin, max: safeMax });
            }}
            className="px-2.5 py-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg transition flex items-center gap-1 cursor-pointer"
            title="Réinitialiser le filtre de prix"
          >
            <RotateCcw className="w-3 h-3" /> Réinitialiser
          </button>
        )}
      </div>

      {/* Current Range Display Badges */}
      <div className="flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-xl border border-zinc-150 dark:border-zinc-800 font-mono text-xs">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold text-zinc-400">Min</span>
          <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
            {formatCFA(localMin)}
          </span>
        </div>
        <div className="text-zinc-400 font-bold text-xs">➔</div>
        <div className="flex flex-col text-right">
          <span className="text-[9px] uppercase font-bold text-zinc-400">Max</span>
          <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
            {formatCFA(localMax)}
          </span>
        </div>
      </div>

      {/* Range Sliders Controls */}
      <div className="space-y-2 pt-1">
        <div className="relative flex flex-col gap-2">
          {/* Dual range control */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
              <span>Prix Minimum</span>
              <span>{formatCFA(localMin)}</span>
            </div>
            <input
              type="range"
              min={safeMin}
              max={safeMax}
              step={step}
              value={localMin}
              onChange={handleMinChange}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
              <span>Prix Maximum</span>
              <span>{formatCFA(localMax)}</span>
            </div>
            <input
              type="range"
              min={safeMin}
              max={safeMax}
              step={step}
              value={localMax}
              onChange={handleMaxChange}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      {!compact && presets.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presets.map((preset, idx) => {
            const isActive = localMin === preset.min && localMax === preset.max;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setLocalMin(preset.min);
                  setLocalMax(preset.max);
                  onChange({ min: preset.min, max: preset.max });
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
