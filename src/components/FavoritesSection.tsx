import React from "react";
import { Star, Eye, Sparkles } from "lucide-react";
import { Product, InventoryItem } from "../types";
import { formatCFA } from "../data";

interface FavoritesSectionProps {
  favoriteIds: string[];
  products: Product[];
  inventory: InventoryItem[];
  onSelectProduct: (product: Product, inventoryItem?: InventoryItem) => void;
}

export const FavoritesSection: React.FC<FavoritesSectionProps> = ({
  favoriteIds,
  products,
  inventory,
  onSelectProduct,
}) => {
  const favoriteProducts = products.filter((p) => favoriteIds.includes(p.id));

  return (
    <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl space-y-4 shadow-xs" id="favorites-section">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-xl">
            <Star className="w-5 h-5 fill-amber-500" />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Mes Articles Favoris
            </h4>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Accès rapide à vos produits préférés
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
          {favoriteProducts.length} favoris
        </span>
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center space-y-2">
          <Star className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
          <p className="text-zinc-500 text-xs text-center max-w-[280px]">
            Aucun article favori. Cliquez sur l'étoile <strong>"Ajouter aux favoris"</strong> dans la fiche d'un produit pour l'ajouter ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {favoriteProducts.map((p) => {
            // Find an inventory item associated with this product (optional)
            const invItem = inventory.find((i) => i.productId === p.id);
            const price = invItem?.price || p.prixGros || p.prixDetail || 1000;

            return (
              <div
                key={`fav-${p.id}`}
                onClick={() => onSelectProduct(p, invItem)}
                className="p-3 bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 rounded-2xl hover:border-amber-400 dark:hover:border-amber-400 cursor-pointer transition-all duration-300 shadow-xs hover:shadow-md flex flex-col justify-between space-y-2 group"
              >
                <div className="flex gap-2.5 items-center">
                  <div className="relative shrink-0">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-11 h-11 rounded-xl object-cover border border-zinc-200/50 dark:border-zinc-750"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute -top-1 -left-1 bg-amber-500 text-white p-0.5 rounded-full shadow-xs">
                      <Star className="w-2.5 h-2.5 fill-white text-white" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-zinc-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {p.name}
                    </p>
                    <p className="text-[9px] text-zinc-500 truncate uppercase tracking-wider mt-0.5">
                      {p.category} • {p.unit}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800 flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-600 font-mono">
                    {formatCFA(price)}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-bold group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Fiche &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
