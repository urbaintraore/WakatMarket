import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, ShoppingCart, ShoppingBag, Plus, Minus, Trash2, 
  User as UserIcon, FileText, CheckCircle, AlertCircle, Download, RefreshCw, CreditCard 
} from "lucide-react";
import { Product, InventoryItem, LightClient, UserRole, UserProfile, Order, DebtPayment } from "../types";
import { formatCFA } from "../data";
import { billingService } from "../services/billingService";

interface CaisseModuleProps {
  currentUser: UserProfile;
  inventory: InventoryItem[];
  products: Product[];
  lightClients: LightClient[];
  users: UserProfile[];
  orders: Order[];
  payments: DebtPayment[];
  onPlaceSale: (
    clientId: string, 
    items: { productId: string; quantity: number }[], 
    amountPaid: number, 
    paymentMethod: string
  ) => void;
}

export function CaisseModule({
  currentUser,
  inventory,
  products,
  lightClients,
  users,
  orders,
  payments,
  onPlaceSale
}: CaisseModuleProps) {
  // 1. Core component state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerType, setCustomerType] = useState<"ANONYME" | "FIDÈLE" | "PARTENAIRE">("ANONYME");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successBillUrl, setSuccessBillUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bypassCreditLimit, setBypassCreditLimit] = useState(false);

  // Credit alerts and push notifications state
  const [showNotification, setShowNotification] = useState(false);
  const [lastNotifiedBuyer, setLastNotifiedBuyer] = useState<string | null>(null);

  // Request browser Notification permission on component mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Reset selected client and bypass toggle when customer type changes
  useEffect(() => {
    setSelectedClientId("");
    setBypassCreditLimit(false);
  }, [customerType]);

  // Reset bypass toggle when selected client changes
  useEffect(() => {
    setBypassCreditLimit(false);
  }, [selectedClientId]);

  const role = currentUser.role;
  const isWholesaler = role === UserRole.WHOLESALER;
  const isRetailer = role === UserRole.RETAILER;
  const isSemiWholesaler = role === UserRole.SEMI_WHOLESALER;

  // Determine pricing model (default to 'GROS' for wholesalers, 'DETAIL' for retailers, choice for semi-wholesalers)
  const [pricingType, setPricingType] = useState<"GROS" | "DETAIL">(
    isWholesaler ? "GROS" : "DETAIL"
  );

  // Selected client's credit details
  const selectedBuyerDetails = useMemo(() => {
    if (!selectedClientId) return null;

    // Check if it's a real user (partenaire)
    const realUser = users.find((u) => u.id === selectedClientId);
    if (realUser) {
      const defaultLimit = 300000; // default 300 000 CFA
      const limit = realUser.creditLimit !== undefined ? realUser.creditLimit : defaultLimit;
      return {
        id: realUser.id,
        name: realUser.name,
        companyName: realUser.companyName,
        phone: realUser.phone,
        limit,
        isRealUser: true,
      };
    }

    // Check if it's a light client (fidèle)
    const lc = lightClients.find((c) => c.id === selectedClientId);
    if (lc) {
      const defaultLimit = 200000; // default 200 000 CFA
      const limit = lc.creditLimit !== undefined ? lc.creditLimit : defaultLimit;
      return {
        id: lc.id,
        name: lc.name,
        companyName: lc.notes,
        phone: lc.phone,
        limit,
        isRealUser: false,
      };
    }

    return null;
  }, [selectedClientId, users, lightClients]);

  // Extract unique categories from products (capitalized for visual elegance)
  const categories = useMemo(() => {
    const list = products.map((p) => {
      const cat = p.category ? p.category.trim() : "Général";
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    });
    return ["Tous", ...Array.from(new Set(list))];
  }, [products]);

  // 2. Compute available products from current inventory filtered by query and category
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return false;
      
      const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const prodCat = prod.category ? prod.category.trim() : "Général";
      const normalizedProdCat = prodCat.charAt(0).toUpperCase() + prodCat.slice(1);
      const matchesCategory = selectedCategory === "Tous" || normalizedProdCat === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [inventory, products, searchQuery, selectedCategory]);

  // Helper to resolve unit price according to selected pricing model
  const getProductPrice = (item: InventoryItem) => {
    if (pricingType === "GROS") {
      return item.prixGros || item.price;
    }
    return item.prixDetail || item.price;
  };

  // Cart operations
  const updateQuantity = (productId: string, delta: number) => {
    const item = inventory.find((i) => i.productId === productId);
    if (!item) return;

    const currentQty = cart[productId] || 0;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      const updatedCart = { ...cart };
      delete updatedCart[productId];
      setCart(updatedCart);
    } else {
      if (newQty > item.stock) {
        setErrorMsg(`Stock insuffisant pour ${products.find(p => p.id === productId)?.name || "ce produit"}.`);
        return;
      }
      setErrorMsg(null);
      setCart({
        ...cart,
        [productId]: newQty,
      });
    }
  };

  const removeFromCart = (productId: string) => {
    const updatedCart = { ...cart };
    delete updatedCart[productId];
    setCart(updatedCart);
  };

  const clearCart = () => {
    setCart({});
    setErrorMsg(null);
  };

  // 3. Totals computation
  const totalAmount = useMemo(() => {
    return Object.keys(cart).reduce((sum, prodId) => {
      const item = inventory.find((i) => i.productId === prodId);
      if (!item) return sum;
      const qty = cart[prodId] || 0;
      return sum + getProductPrice(item) * qty;
    }, 0);
  }, [cart, inventory, pricingType]);

  // Auto-set amountPaid to totalAmount whenever totalAmount changes
  useEffect(() => {
    setAmountPaid(totalAmount);
  }, [totalAmount]);

  // Reset selected client when customer type changes
  useEffect(() => {
    setSelectedClientId("");
  }, [customerType]);

  // Compute unified list of buyers ("Mes Acheteurs" context)
  const myBuyers = useMemo(() => {
    const list: { id: string; name: string; type: "PARTENAIRE" | "FIDÈLE"; phone: string; companyName?: string; roleOrType: string }[] = [];

    // A. Real users who have placed B2B orders with the currentUser OR are connected
    const realUserIds = new Set<string>();
    orders.forEach((o) => {
      if (o.receiverId === currentUser.id && o.senderId && o.senderId !== currentUser.id) {
        realUserIds.add(o.senderId);
      }
      if (o.senderId === currentUser.id && o.receiverId && o.receiverId !== "CASH_CLIENT" && o.receiverId !== currentUser.id) {
        realUserIds.add(o.receiverId);
      }
    });

    realUserIds.forEach((uid) => {
      const u = users.find((profile) => profile.id === uid);
      if (u) {
        list.push({
          id: u.id,
          name: u.name,
          phone: u.phone,
          companyName: u.companyName,
          roleOrType: u.role === "SEMI_WHOLESALER" ? "Partenaire Demi-Grossiste" : (u.role === "RETAILER" ? "Partenaire Détaillant" : "Partenaire Client"),
          type: "PARTENAIRE"
        });
      }
    });

    // B. LightClients (Clients locaux fidèles)
    const myLightClients = lightClients.filter((lc) => lc.ownerId === currentUser.id);
    myLightClients.forEach((lc) => {
      if (lc.linkedUserId && list.some((b) => b.id === lc.linkedUserId)) {
        return;
      }
      list.push({
        id: lc.id,
        name: lc.name,
        phone: lc.phone,
        companyName: lc.notes,
        roleOrType: "Client Fidèle (Crédit)",
        type: "FIDÈLE"
      });
    });

    return list;
  }, [currentUser, users, orders, lightClients]);

  // Filter buyers matching selection (FIDÈLE or PARTENAIRE)
  const dropdownBuyers = useMemo(() => {
    return myBuyers.filter((b) => b.type === customerType);
  }, [myBuyers, customerType]);

  const selectedBuyerDebt = useMemo(() => {
    if (!selectedClientId) return 0;

    // 1. Calculate orders debt
    const buyerOrders = orders.filter((o) => {
      const isSeller = o.senderId === currentUser.id || o.receiverId === currentUser.id;
      if (!isSeller) return false;
      return o.senderId === selectedClientId || o.receiverId === selectedClientId || o.clientId === selectedClientId;
    });

    const totalPurchased = buyerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const amountPaidInOrders = buyerOrders.reduce((sum, o) => sum + o.amountPaid, 0);

    // 2. Payments registered in DebtPayments
    const buyerPayments = payments ? payments.filter((p) => p.clientId === selectedClientId) : [];
    const totalAdditionalPaid = buyerPayments.reduce((sum, p) => sum + p.amount, 0);

    return Math.max(0, totalPurchased - amountPaidInOrders - totalAdditionalPaid);
  }, [selectedClientId, orders, payments, currentUser.id]);

  const unpaidPortion = useMemo(() => {
    return Math.max(0, totalAmount - amountPaid);
  }, [totalAmount, amountPaid]);

  const projectedDebt = useMemo(() => {
    return selectedBuyerDebt + unpaidPortion;
  }, [selectedBuyerDebt, unpaidPortion]);

  const creditLimitExceeded = useMemo(() => {
    if (!selectedBuyerDetails) return false;
    return projectedDebt > selectedBuyerDetails.limit;
  }, [selectedBuyerDetails, projectedDebt]);

  // Monitor selected buyer's credit limit and trigger alerts/notifications when they reach 80% or more
  useEffect(() => {
    if (!selectedClientId || !selectedBuyerDetails) {
      setShowNotification(false);
      return;
    }

    const limit = selectedBuyerDetails.limit;
    if (limit <= 0) {
      setShowNotification(false);
      return;
    }

    const currentPercent = (selectedBuyerDebt / limit) * 100;
    const projectedPercent = (projectedDebt / limit) * 100;

    // Trigger alert if usage is >= 80%
    if (projectedPercent >= 80) {
      const key = `${selectedClientId}_${Math.floor(projectedPercent)}`;
      if (lastNotifiedBuyer !== key) {
        setShowNotification(true);
        setLastNotifiedBuyer(key);

        // Try to trigger real browser Push Notification
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            try {
              new Notification("Seuil de Crédit Critique - 80%+", {
                body: `Attention : l'acheteur ${selectedBuyerDetails.name} a atteint ${projectedPercent.toFixed(0)}% de sa limite de crédit (${formatCFA(selectedBuyerDebt)} en cours + ${formatCFA(unpaidPortion)} projeté).`,
                tag: "credit-alert-" + selectedClientId
              });
            } catch (e) {
              console.log("Error launching native notification:", e);
            }
          }
        }
      }
    } else {
      setShowNotification(false);
    }
  }, [selectedClientId, selectedBuyerDebt, projectedDebt, selectedBuyerDetails, lastNotifiedBuyer, unpaidPortion]);

  // 4. Validate and execute checkout
  const handleCheckout = async () => {
    if (Object.keys(cart).length === 0) return;
    
    // Validation for credit/partner buyers
    if (customerType !== "ANONYME" && !selectedClientId) {
      setErrorMsg("Veuillez sélectionner un acheteur de votre carnet d'associés.");
      return;
    }

    if (customerType !== "ANONYME" && creditLimitExceeded && !bypassCreditLimit) {
      setErrorMsg(`Transaction bloquée : la limite de crédit de ${selectedBuyerDetails?.name} (${formatCFA(selectedBuyerDetails?.limit || 0)}) est dépassée.`);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const lines = Object.keys(cart).map((prodId) => {
        const prod = products.find((p) => p.id === prodId);
        const item = inventory.find((i) => i.productId === prodId);
        const price = getProductPrice(item!);
        const qty = cart[prodId] || 0;
        return {
          produitId: prodId,
          nom: prod?.name || "Produit",
          quantite: qty,
          prixUnitaire: price,
          sousTotal: price * qty
        };
      });

      // Find chosen buyer info
      let acheteurNom = "Client Final Anonyme";
      if (customerType !== "ANONYME" && selectedClientId) {
        const buyer = myBuyers.find((b) => b.id === selectedClientId);
        if (buyer) {
          acheteurNom = buyer.companyName ? `${buyer.name} (${buyer.companyName})` : buyer.name;
        }
      }

      const invoiceData = {
        venteId: "sale_" + Date.now().toString(),
        vendeurId: currentUser.id,
        vendeurNom: currentUser.companyName || currentUser.name,
        vendeurRole: currentUser.role,
        acheteurId: selectedClientId || undefined,
        acheteurNom,
        typeVente: pricingType,
        lignes: lines,
        total: totalAmount
      };

      // Determine correct payment method and process
      const paymentMethod = amountPaid < totalAmount ? "DEFERRED" : "CASH";

      const purchaseItems = Object.keys(cart).map((prodId) => ({
        productId: prodId,
        quantity: cart[prodId] || 0
      }));

      await onPlaceSale(
        selectedClientId || "CASH_CLIENT", 
        purchaseItems, 
        amountPaid, 
        paymentMethod
      );

      // Generate invoice
      const pdfUrl = await billingService.genererEtEnregistrerFacture(invoiceData);
      
      setSuccessBillUrl(pdfUrl);
      setCart({});
    } catch (err: any) {
      setErrorMsg(err.message || "Échec de validation de la transaction.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (successBillUrl) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-emerald-150 dark:border-emerald-900/40 p-8 rounded-2xl text-center max-w-md mx-auto shadow-md animate-fade-in" id="caisse-success">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">Transaction Réussie</h3>
        <p className="text-xs text-zinc-500 mb-6">Le stock a été décrémenté et la facture a été générée.</p>
        
        <div className="flex flex-col gap-2">
          <a
            href={successBillUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <Download className="w-4 h-4" /> Télécharger Facture
          </a>
          <button
            onClick={() => setSuccessBillUrl(null)}
            className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-750 py-2.5 rounded-xl font-bold transition text-xs cursor-pointer"
          >
            Faire une autre vente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="caisse-module">
      {/* 1. Catalog & Selection Section */}
      <div className="lg:col-span-2 space-y-4">
        {/* Visual warning notification banner for 80%+ credit limit usage */}
        {showNotification && selectedBuyerDetails && (
          <div 
            className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex items-start justify-between gap-3 shadow-md animate-pulse" 
            id="credit-limit-80-warning-banner"
          >
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-[10px] text-amber-800 dark:text-amber-300 uppercase tracking-widest">
                  ⚠️ SEUIL DE CRÉDIT CRITIQUE ATTEINT
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-normal">
                  L'acheteur <span className="underline">{selectedBuyerDetails.name}</span> a consommé{" "}
                  <span className="text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                    {((projectedDebt / selectedBuyerDetails.limit) * 100).toFixed(0)}%
                  </span>{" "}
                  de sa limite de crédit autorisée.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-zinc-500 font-bold">
                  <span>Limite : <strong className="font-mono text-zinc-800 dark:text-zinc-200">{formatCFA(selectedBuyerDetails.limit)}</strong></span>
                  <span>En cours : <strong className="font-mono text-zinc-800 dark:text-zinc-200">{formatCFA(selectedBuyerDebt)}</strong></span>
                  {unpaidPortion > 0 && (
                    <span>Nouveau : <strong className="font-mono text-zinc-800 dark:text-zinc-200">+{formatCFA(unpaidPortion)}</strong></span>
                  )}
                  <span className="text-rose-600 dark:text-rose-400">Total Projeté : <strong className="font-mono">{formatCFA(projectedDebt)}</strong></span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 font-extrabold text-sm p-1.5 cursor-pointer leading-none hover:bg-amber-100/40 rounded-lg transition-colors"
              title="Fermer cette notification"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:text-rose-400 border-rose-950/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher des articles en stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 transition shadow-inner"
            />
          </div>

          {/* Pricing tier switcher */}
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl shrink-0 w-full sm:w-auto border border-zinc-200/50 dark:border-zinc-850">
            <button
              onClick={() => setPricingType("GROS")}
              disabled={isRetailer}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                pricingType === "GROS" 
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-emerald-700 dark:text-emerald-400" 
                  : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300"
              } ${isRetailer ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              Tarif Gros
            </button>
            <button
              onClick={() => setPricingType("DETAIL")}
              disabled={isWholesaler}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                pricingType === "DETAIL" 
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-emerald-700 dark:text-emerald-400" 
                  : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300"
              } ${isWholesaler ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              Tarif Détail
            </button>
          </div>
        </div>

        {/* Product Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none pt-0.5" id="caisse-categories-filter">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/25"
                    : "bg-white dark:bg-zinc-900 border-zinc-150 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
          {filteredInventory.length === 0 ? (
            <div className="col-span-full py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs italic">
              Aucun produit ne correspond à votre recherche.
            </div>
          ) : (
            filteredInventory.map((item) => {
              const prod = products.find((p) => p.id === item.productId);
              if (!prod) return null;
              const unitPrice = getProductPrice(item);
              const isSelected = !!cart[prod.id];

              return (
                <div 
                  key={item.id} 
                  className={`p-3 bg-white dark:bg-zinc-900 border rounded-xl flex items-center justify-between shadow-xs transition-all ${
                    isSelected 
                      ? "border-emerald-500 ring-1 ring-emerald-500/20" 
                      : "border-zinc-150 dark:border-zinc-850 hover:border-emerald-200 dark:hover:border-emerald-900/30"
                  }`}
                >
                  <div className="flex gap-3 items-center min-w-0">
                    <img 
                      loading="lazy" 
                      src={prod.image} 
                      alt={prod.name} 
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-50 shrink-0" 
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-[11px] text-zinc-950 dark:text-white truncate">{prod.name}</p>
                      <p className="text-[9px] text-zinc-500 font-bold">En Stock: {item.stock} {prod.unit}</p>
                      <p className="text-[11px] font-black text-emerald-600 mt-0.5">{formatCFA(unitPrice)}</p>
                    </div>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-150 dark:border-zinc-800">
                    <button
                      onClick={() => updateQuantity(prod.id, -1)}
                      disabled={!isSelected}
                      className="w-6 h-6 rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-black text-xs cursor-pointer disabled:opacity-40"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-zinc-900 dark:text-white">
                      {cart[prod.id] || 0}
                    </span>
                    <button
                      onClick={() => updateQuantity(prod.id, 1)}
                      disabled={item.stock <= (cart[prod.id] || 0)}
                      className="w-6 h-6 rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-black text-xs cursor-pointer disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Customer & Checkout Summary */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" /> Panier Caisse
            </h4>
            {Object.keys(cart).length > 0 && (
              <button 
                onClick={clearCart}
                className="text-[10px] text-zinc-400 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Vider
              </button>
            )}
          </div>

          {/* Cart itemized view */}
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-none">
            {Object.keys(cart).length === 0 ? (
              <div className="py-8 text-center text-zinc-400 dark:text-zinc-500 italic text-[11px]">
                Le panier est encore vide.
              </div>
            ) : (
              Object.keys(cart).map((prodId) => {
                const qty = cart[prodId] || 0;
                const prod = products.find((p) => p.id === prodId);
                const item = inventory.find((i) => i.productId === prodId);
                const px = getProductPrice(item!);
                return (
                  <div key={prodId} className="flex justify-between items-start text-[11px] group">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{prod?.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {qty} x {formatCFA(px)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-zinc-900 dark:text-white whitespace-nowrap">
                        {formatCFA(px * qty)}
                      </span>
                      <button 
                        onClick={() => removeFromCart(prodId)}
                        className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Customer Selection */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-zinc-400" /> Type d'Acheteur
              </label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 transition"
              >
                <option value="ANONYME">Client Final Anonyme</option>
                <option value="FIDÈLE">Client Fidèle (Crédit)</option>
                <option value="PARTENAIRE">Partenaire (Mes Acheteurs)</option>
              </select>
            </div>

            {customerType !== "ANONYME" && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Sélectionner l'Acheteur ({dropdownBuyers.length})
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 transition font-bold"
                >
                  <option value="">-- Choisissez dans "Mes Acheteurs" --</option>
                  {dropdownBuyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.companyName ? `(${b.companyName})` : ""} - {b.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* If Client Fidèle or Partenaire is selected, display Amount Paid input for credit/deferred sales */}
            {customerType !== "ANONYME" && Object.keys(cart).length > 0 && (
              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 animate-fade-in">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-zinc-400" /> Règlement Reçu
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={amountPaid}
                    max={totalAmount}
                    onChange={(e) => setAmountPaid(Math.max(0, Math.min(totalAmount, parseFloat(e.target.value) || 0)))}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAmountPaid(0)}
                    className="px-2 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg text-[9px] font-bold"
                  >
                    À Crédit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountPaid(totalAmount)}
                    className="px-2 py-2 bg-emerald-150 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 rounded-lg text-[9px] font-bold"
                  >
                    Payé
                  </button>
                </div>
                {amountPaid < totalAmount && (
                  <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Restant dû : {formatCFA(totalAmount - amountPaid)} (Inscrit à son ardoise)
                  </p>
                )}
              </div>
            )}

            {/* Credit Limit Exceeded Automatic Alert Panel */}
            {customerType !== "ANONYME" && creditLimitExceeded && selectedBuyerDetails && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/30 rounded-xl space-y-2.5 animate-fade-in text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-900 dark:text-rose-300">Alerte : Limite de crédit dépassée !</p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                      L'encours maximum autorisé pour <span className="font-semibold">{selectedBuyerDetails.name}</span> est de <span className="font-bold">{formatCFA(selectedBuyerDetails.limit)}</span>.
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rose-100 dark:border-rose-900/20 text-[10px] text-rose-800 dark:text-rose-400">
                  <div>
                    <p className="text-zinc-400 uppercase font-black tracking-wider text-[8px]">Dette Actuelle</p>
                    <p className="font-bold font-mono text-zinc-800 dark:text-zinc-200">{formatCFA(selectedBuyerDebt)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 uppercase font-black tracking-wider text-[8px]">Nouvel Achat</p>
                    <p className="font-bold font-mono text-zinc-800 dark:text-zinc-200">+{formatCFA(unpaidPortion)}</p>
                  </div>
                  <div>
                    <p className="text-rose-500 uppercase font-black tracking-wider text-[8px]">Encours Projeté</p>
                    <p className="font-black font-mono text-rose-600 dark:text-rose-400">{formatCFA(projectedDebt)}</p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bypass-credit"
                    checked={bypassCreditLimit}
                    onChange={(e) => setBypassCreditLimit(e.target.checked)}
                    className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                  />
                  <label htmlFor="bypass-credit" className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 cursor-pointer select-none">
                    Forcer la vente (Dérogation exceptionnelle)
                  </label>
                </div>
              </div>
            )}

            {/* Total display */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">TOTAL À PAYER</span>
                <span className="text-lg font-black text-emerald-900 dark:text-emerald-200 font-mono">
                  {formatCFA(totalAmount)}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={Object.keys(cart).length === 0 || isProcessing || (customerType !== "ANONYME" && creditLimitExceeded && !bypassCreditLimit)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (customerType !== "ANONYME" && creditLimitExceeded && !bypassCreditLimit) ? (
                <>
                  <AlertCircle className="w-4 h-4" /> Limite de crédit dépassée
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" /> Enregistrer & Facturer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
