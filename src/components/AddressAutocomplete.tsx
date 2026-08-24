import React, { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, Building, Navigation, Check, X, Search } from "lucide-react";
import { db, MOCK_GEOGRAPHY } from "../data";
import { UserProfile } from "../types";

export interface AddressSuggestion {
  text: string;
  type: "city" | "neighborhood" | "full" | "country";
  city?: string;
  neighborhood?: string;
  country?: string;
}

/**
 * Extracts and normalizes unique cities, neighborhoods, and addresses from db.getUsers()
 * combined with MOCK_GEOGRAPHY locations.
 */
export function getAddressSuggestionsFromUsers(usersList?: UserProfile[]): AddressSuggestion[] {
  const users = usersList && usersList.length > 0 ? usersList : db.getUsers();
  const suggestionsMap = new Map<string, AddressSuggestion>();

  const addSuggestion = (text: string, type: AddressSuggestion["type"], city?: string, neighborhood?: string, country?: string) => {
    if (!text || text.trim().length < 2) return;
    const cleanText = text.trim();
    const key = cleanText.toLowerCase();
    if (!suggestionsMap.has(key)) {
      suggestionsMap.set(key, { text: cleanText, type, city, neighborhood, country });
    }
  };

  // 1. Extract from standard geography
  MOCK_GEOGRAPHY.forEach((node) => {
    if (node.type === "REGION") {
      addSuggestion(node.name, "city", node.name);
    } else if (node.type === "PROVINCE") {
      addSuggestion(node.name, "neighborhood", undefined, node.name);
    } else if (node.type === "PAYS") {
      addSuggestion(node.name, "country", undefined, undefined, node.name);
    }
  });

  // 2. Extract dynamically from users in db.getUsers()
  users.forEach((u) => {
    if (u.region) {
      addSuggestion(u.region, "city", u.region, undefined, u.country);
    }
    if (u.province) {
      addSuggestion(u.province, "neighborhood", u.region, u.province, u.country);
    }
    if (u.commune) {
      addSuggestion(u.commune, "neighborhood", u.region, u.commune, u.country);
    }
    if (u.sector) {
      addSuggestion(u.sector, "neighborhood", u.region, u.sector, u.country);
    }
    if (u.address) {
      addSuggestion(u.address, "full", u.region, u.province || u.sector, u.country);
    }
    // Combined city + neighborhood if both available
    if (u.region && (u.province || u.sector || u.commune)) {
      const sub = u.province || u.sector || u.commune;
      addSuggestion(`${sub}, ${u.region}`, "full", u.region, sub, u.country);
    }
  });

  // 3. Add well-known urban zones across West Africa if not yet present
  const defaultZones = [
    { text: "Ouaga 2000, Ouagadougou", type: "full" as const, city: "Ouagadougou", neighborhood: "Ouaga 2000" },
    { text: "Gounghin, Ouagadougou", type: "full" as const, city: "Ouagadougou", neighborhood: "Gounghin" },
    { text: "Tampouy, Ouagadougou", type: "full" as const, city: "Ouagadougou", neighborhood: "Tampouy" },
    { text: "Pissy, Ouagadougou", type: "full" as const, city: "Ouagadougou", neighborhood: "Pissy" },
    { text: "Kalgondin, Ouagadougou", type: "full" as const, city: "Ouagadougou", neighborhood: "Kalgondin" },
    { text: "Patte d'Oie, Ouagadougou", type: "full" as const, city: "Ouagadougou", neighborhood: "Patte d'Oie" },
    { text: "Secteur 15, Ouagadougou", type: "full" as const, city: "Ouagadougou", neighborhood: "Secteur 15" },
    { text: "Secteur 22, Bobo-Dioulasso", type: "full" as const, city: "Bobo-Dioulasso", neighborhood: "Secteur 22" },
    { text: "Accart-Ville, Bobo-Dioulasso", type: "full" as const, city: "Bobo-Dioulasso", neighborhood: "Accart-Ville" },
    { text: "Cocody Riviera, Abidjan", type: "full" as const, city: "Abidjan", neighborhood: "Cocody Riviera" },
    { text: "Plateau, Abidjan", type: "full" as const, city: "Abidjan", neighborhood: "Plateau" },
    { text: "Marcory Zone 4, Abidjan", type: "full" as const, city: "Abidjan", neighborhood: "Marcory" },
    { text: "Almadies, Dakar", type: "full" as const, city: "Dakar", neighborhood: "Almadies" },
    { text: "Médina, Dakar", type: "full" as const, city: "Dakar", neighborhood: "Médina" },
  ];

  defaultZones.forEach(z => {
    if (!suggestionsMap.has(z.text.toLowerCase())) {
      suggestionsMap.set(z.text.toLowerCase(), z);
    }
  });

  return Array.from(suggestionsMap.values());
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  typeFilter?: "all" | "city" | "neighborhood" | "full";
  usersList?: UserProfile[];
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = "Ex: Ouaga 2000, Secteur 15, Ouagadougou...",
  label,
  required = false,
  className = "",
  inputClassName = "",
  id,
  typeFilter = "all",
  usersList
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allSuggestions = useMemo(() => {
    return getAddressSuggestionsFromUsers(usersList);
  }, [usersList]);

  const filteredSuggestions = useMemo(() => {
    if (!value || value.trim().length === 0) {
      // Return top common suggestions when empty and focused
      return allSuggestions
        .filter(s => typeFilter === "all" || s.type === typeFilter || s.type === "full")
        .slice(0, 6);
    }

    const query = value.toLowerCase().trim();
    return allSuggestions
      .filter((item) => {
        if (typeFilter !== "all" && item.type !== typeFilter && item.type !== "full") {
          return false;
        }
        return (
          item.text.toLowerCase().includes(query) ||
          (item.city && item.city.toLowerCase().includes(query)) ||
          (item.neighborhood && item.neighborhood.toLowerCase().includes(query))
        );
      })
      .slice(0, 8);
  }, [allSuggestions, value, typeFilter]);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: AddressSuggestion) => {
    onChange(item.text);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === "ArrowDown") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(filteredSuggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1 text-xs flex items-center justify-between">
          <span>{label} {required && <span className="text-rose-500">*</span>}</span>
          <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Suggestions automatiques
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        <MapPin className="w-4 h-4 text-emerald-600 absolute left-3 pointer-events-none shrink-0" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          required={required}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`w-full pl-9 pr-8 py-2 text-xs border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition ${inputClassName}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
            title="Effacer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Suggestions List */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto animate-in fade-in-50 duration-150">
          <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Villes & Quartiers WakatMarket ({filteredSuggestions.length})</span>
            <span className="text-emerald-600 font-semibold">Basé sur la base de données</span>
          </div>

          <div className="p-1 space-y-0.5">
            {filteredSuggestions.map((item, idx) => {
              const isSelected = idx === highlightedIndex;
              return (
                <button
                  key={`${item.text}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded-md bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                      {item.type === "city" ? <Building className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    </span>
                    <span className="truncate">{item.text}</span>
                  </div>

                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                    item.type === "city"
                      ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                      : item.type === "neighborhood"
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                      : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {item.type === "city" ? "Ville" : item.type === "neighborhood" ? "Quartier" : "Adresse"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
