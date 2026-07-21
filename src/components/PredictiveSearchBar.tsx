import React, { useState, useRef, useEffect } from "react";
import { Search, Sparkles, Tag, Package, X } from "lucide-react";
import { Product } from "../types";

interface Props {
  value: string;
  onChange: (newValue: string) => void;
  products: Product[];
  placeholder?: string;
  className?: string;
  onSelectProduct?: (product: Product) => void;
}

export function PredictiveSearchBar({
  value,
  onChange,
  products,
  placeholder = "Rechercher un produit...",
  className = "",
  onSelectProduct
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    categories: string[];
    items: Product[];
  }>({ categories: [], items: [] });
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter products and categories as the user types
  useEffect(() => {
    if (!value.trim()) {
      setSuggestions({ categories: [], items: [] });
      return;
    }

    const query = value.toLowerCase();

    // 1. Match categories
    const allCategories = Array.from(new Set(products.map(p => p.category || "Général")));
    const matchedCategories = allCategories.filter(cat => 
      cat.toLowerCase().includes(query)
    ).slice(0, 3);

    // 2. Match products (by name or category)
    const matchedProducts = products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.category && p.category.toLowerCase().includes(query))
    ).slice(0, 5);

    setSuggestions({
      categories: matchedCategories,
      items: matchedProducts
    });
  }, [value, products]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCategory = (cat: string) => {
    onChange(cat);
    setIsOpen(false);
  };

  const handleSelectProduct = (prod: Product) => {
    onChange(prod.name);
    if (onSelectProduct) {
      onSelectProduct(prod);
    }
    setIsOpen(false);
  };

  const clearSearch = () => {
    onChange("");
    setIsOpen(false);
  };

  const hasSuggestions = suggestions.categories.length > 0 || suggestions.items.length > 0;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
        />
        {value && (
          <button
            onClick={clearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && hasSuggestions && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 animate-fade-in">
          {/* Categories Suggestions */}
          {suggestions.categories.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 px-2.5 py-1 flex items-center gap-1 uppercase tracking-wider">
                <Tag className="w-3 h-3 text-emerald-500" /> Catégories suggérées
              </p>
              <div className="flex flex-wrap gap-1.5 p-1 px-2">
                {suggestions.categories.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectCategory(cat)}
                    className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg text-[10px] font-semibold transition border border-zinc-100 dark:border-zinc-750 flex items-center gap-1"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products Suggestions */}
          {suggestions.items.length > 0 && (
            <div className="p-1">
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 px-3 py-1.5 flex items-center gap-1 uppercase tracking-wider">
                <Package className="w-3 h-3 text-emerald-500" /> Produits suggérés
              </p>
              <div className="space-y-0.5">
                {suggestions.items.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-lg transition"
                  >
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-7 h-7 rounded object-cover flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-medium">
                        {prod.category} • Unité : {prod.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
