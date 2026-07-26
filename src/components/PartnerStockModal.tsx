import React, { useState, useMemo } from "react";
import { 
  X, Store, Package, ShoppingCart, MessageSquare, 
  MapPin, Phone, Mail, Star, ShieldCheck, Search, Filter, CheckCircle2, AlertTriangle, ChevronRight
} from "lucide-react";
import { UserProfile, Product, InventoryItem, UserRole } from "../types";
import { formatCFA } from "../data";

interface PartnerStockModalProps {
  partner: {
    id: string;
    name: string;
    companyName?: string;
    role: string | UserRole;
    phone?: string;
    email?: string;
    country?: string;
    region?: string;
    commune?: string;
    address?: string;
    rating?: number;
    avatar?: string;
  };
  currentUser: UserProfile | null;
  products: Product[];
  inventory: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onInitiateOrder?: (partnerId: string, productId?: string) => void;
  onOpenChat?: (partnerId: string) => void;
}

export const PartnerStockModal: React.FC<PartnerStockModalProps> = ({
  partner,
  currentUser,
  products,
  inventory,
  isOpen,
  onClose,
  onInitiateOrder,
  onOpenChat
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Get all inventory items belonging to this partner establishment
  const partnerInventory = useMemo(() => {
    return inventory.filter(item => item.ownerId === partner.id);
  }, [inventory, partner.id]);

  // Combine inventory items with full product details
  const partnerStockList = useMemo(() => {
    return partnerInventory.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        item,
        product
      };
    }).filter(({ product }) => product !== undefined);
  }, [partnerInventory, products]);

  // Also fallback to products created by this partner if no specific inventory items found
  const partnerProductsList = useMemo(() => {
    if (partnerStockList.length > 0) return partnerStockList;
    return products.filter(p => p.creatorId === partner.id).map(product => {
      const mockItem: InventoryItem = {
        id: `inv-${product.id}`,
        productId: product.id,
        ownerId: partner.id,
        stock: 100, // Available stock estimate
        threshold: product.lowStockThreshold || 10,
        price: product.prixGros || product.prixDetail || 1000,
        prixGros: product.prixGros,
        prixDetail: product.prixDetail
      };
      return { item: mockItem, product };
    });
  }, [partnerStockList, products, partner.id]);

  // Filter by search & category
  const filteredStock = useMemo(() => {
    return partnerProductsList.filter(({ product, item }) => {
      if (!product) return false;
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === "ALL" || product.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [partnerProductsList, searchQuery, selectedCategory]);

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    partnerProductsList.forEach(({ product }) => {
      if (product?.category) cats.add(product.category);
    });
    return Array.from(cats);
  }, [partnerProductsList]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case UserRole.MANUFACTURER: return "Fabricant Industriels";
      case UserRole.WHOLESALER: return "Grossiste B2B";
      case UserRole.SEMI_WHOLESALER: return "Demi-Grossiste";
      case UserRole.RETAILER: return "Détaillant / Boutique";
      case UserRole.CLIENT: return "Client / Acheteur";
      default: return role;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 text-white flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start gap-4 z-10">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center text-white font-black text-xl shrink-0 shadow-inner">
              {partner.avatar ? (
                <img src={partner.avatar} alt={partner.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Store className="w-7 h-7 text-emerald-300" />
              )}
            </div>
            
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-lg sm:text-xl text-white leading-tight">
                  {partner.companyName || partner.name}
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" /> Partenaire Certifié
                </span>
              </div>

              <p className="text-xs text-emerald-100/90 mt-1 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-white bg-white/15 px-2 py-0.5 rounded-md">
                  {getRoleLabel(partner.role)}
                </span>
                {partner.region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-300" />
                    {partner.commune ? `${partner.commune}, ` : ''}{partner.region} ({partner.country || 'Burkina Faso'})
                  </span>
                )}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition text-white cursor-pointer z-10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Establishment Contact & Metrics Bar */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4 text-zinc-600 dark:text-zinc-300 font-medium">
            {partner.phone && (
              <a href={`tel:${partner.phone}`} className="flex items-center gap-1.5 hover:text-emerald-600 font-mono font-semibold">
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> {partner.phone}
              </a>
            )}
            {partner.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-600" /> {partner.email}
              </span>
            )}
            {partner.rating && (
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> {partner.rating} / 5
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenChat && (
              <button
                type="button"
                onClick={() => {
                  onOpenChat(partner.id);
                  onClose();
                }}
                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Discuter Directement
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un produit dans le stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none py-1">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedCategory === "ALL"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                }`}
              >
                Toutes les catégories
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stock List Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              Stock Disponible ({filteredStock.length} Références)
            </h4>
            <span className="text-[10px] text-zinc-400 font-mono">
              Mis à jour en temps réel via le réseau souverain Wakat
            </span>
          </div>

          {filteredStock.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-700">
              <Package className="w-12 h-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
              <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">Aucun produit trouvé dans le stock de cet établissement.</p>
              <p className="text-xs text-zinc-500 mt-1">Essayez de modifier votre recherche ou contactez directement l'établissement par messagerie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStock.map(({ item, product }) => {
                if (!product) return null;
                const isLowStock = item.stock <= (item.lowStockThreshold || item.threshold || 10);
                const isOutOfStock = item.stock <= 0;

                return (
                  <div 
                    key={item.id}
                    className="p-4 bg-white dark:bg-zinc-850 border border-zinc-200/90 dark:border-zinc-750 rounded-2xl shadow-xs hover:shadow-md hover:border-emerald-500/50 transition flex flex-col justify-between gap-3 group"
                  >
                    <div className="flex gap-3">
                      <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 relative">
                        <img 
                          src={product.image || product.imageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300"} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        {isOutOfStock ? (
                          <span className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-[9px] font-black text-rose-300 uppercase tracking-wider p-1 text-center">
                            Rupture
                          </span>
                        ) : isLowStock && (
                          <span className="absolute top-1 right-1 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                            Bas
                          </span>
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <h5 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                            {product.name}
                          </h5>
                          <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-semibold rounded-md shrink-0">
                            {product.category}
                          </span>
                        </div>

                        <p className="text-[11px] text-zinc-500 font-medium">
                          {product.unit ? `Conditionnement : ${product.unit}` : ''} {product.brand ? `• Marque : ${product.brand}` : ''}
                        </p>

                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                            {formatCFA(item.prixGros || item.price || product.prixGros || product.prixDetail || 0)}
                          </span>
                          {product.prixDetail && product.prixDetail !== item.price && (
                            <span className="text-[10px] text-zinc-400 line-through">
                              {formatCFA(product.prixDetail)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stock status & Action line */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                        }`} />
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          Stock : <strong className={isOutOfStock ? "text-rose-600 font-extrabold" : "text-emerald-600 font-extrabold"}>{item.stock} {product.unit || 'unités'}</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => {
                          if (onInitiateOrder) {
                            onInitiateOrder(partner.id, product.id);
                            onClose();
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                          isOutOfStock
                            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Acheter / Commander</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Accès au stock partenaire sécurisé par souveraineté nationale WakatMarket.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Fermer
            </button>
            {onInitiateOrder && (
              <button
                type="button"
                onClick={() => {
                  onInitiateOrder(partner.id);
                  onClose();
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Passer une commande complète</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
