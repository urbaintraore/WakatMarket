/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  UserRole, UserProfile, Product, InventoryItem, Order, OrderStatus, 
  ChatMessage, AIRecommendation, GeoNode, PlatformStats, 
  LightClient, StockMovement, DebtPayment, PriceTier,
  Connection, Notification
} from "./types";

// Simulated Geographies in Africa
export const MOCK_GEOGRAPHY: GeoNode[] = [
  { id: "SENEGAL", name: "Sénégal", type: "PAYS" },
  { id: "SEN-DAKAR", name: "Dakar", type: "REGION", parentId: "SENEGAL" },
  { id: "SEN-THIES", name: "Thiès", type: "REGION", parentId: "SENEGAL" },
  { id: "SEN-DK-PLATEAU", name: "Dakar Plateau", type: "PROVINCE", parentId: "SEN-DAKAR" },
  { id: "SEN-DK-MEDINA", name: "La Médina", type: "PROVINCE", parentId: "SEN-DAKAR" },
  { id: "SEN-DK-ALMADIES", name: "Les Almadies", type: "PROVINCE", parentId: "SEN-DAKAR" },

  { id: "COTE_IVOIRE", name: "Côte d'Ivoire", type: "PAYS" },
  { id: "CIV-ABIDJAN", name: "Abidjan", type: "REGION", parentId: "COTE_IVOIRE" },
  { id: "CIV-BOUAKE", name: "Bouaké", type: "REGION", parentId: "COTE_IVOIRE" },
  { id: "CIV-ABJ-COCODY", name: "Cocody", type: "PROVINCE", parentId: "CIV-ABIDJAN" },
  { id: "CIV-ABJ-PLATEAU", name: "Le Plateau", type: "PROVINCE", parentId: "CIV-ABIDJAN" },
  { id: "CIV-ABJ-MARCORY", name: "Marcory", type: "PROVINCE", parentId: "CIV-ABIDJAN" },

  { id: "BURKINA", name: "Burkina Faso", type: "PAYS" },
  { id: "BFA-OUAGA", name: "Ouagadougou", type: "REGION", parentId: "BURKINA" },
  { id: "BFA-BOBO", name: "Bobo-Dioulasso", type: "REGION", parentId: "BURKINA" },
  { id: "BFA-OUA-SECTOR15", name: "Ouaga 2000 (Secteur 15)", type: "PROVINCE", parentId: "BFA-OUAGA" },
  { id: "BFA-OUA-CENTER", name: "Koulouba", type: "PROVINCE", parentId: "BFA-OUAGA" },
];

// Coordinates for Map simulation
export const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Dakar Plateau": { lat: 14.667, lng: -17.433 },
  "La Médina": { lat: 14.685, lng: -17.445 },
  "Les Almadies": { lat: 14.747, lng: -17.514 },
  "Dakar": { lat: 14.716, lng: -17.467 },
  "Cocody": { lat: 5.362, lng: -3.982 },
  "Le Plateau": { lat: 5.321, lng: -4.019 },
  "Marcory": { lat: 5.309, lng: -3.988 },
  "Abidjan": { lat: 5.336, lng: -4.026 },
  "Ouaga 2000 (Secteur 15)": { lat: 12.311, lng: -1.503 },
  "Koulouba": { lat: 12.378, lng: -1.517 },
  "Ouagadougou": { lat: 12.368, lng: -1.527 },
};

// Seed Users
const INITIAL_USERS: UserProfile[] = [];

// Seed Products
const INITIAL_PRODUCTS: Product[] = [];

// Seed Light Clients
const INITIAL_LIGHT_CLIENTS: LightClient[] = [];

// Seed Stock Movements
const INITIAL_MOVEMENTS: StockMovement[] = [];

// Seed Payments
const INITIAL_PAYMENTS: DebtPayment[] = [];

// Seed Inventory
const INITIAL_INVENTORY: InventoryItem[] = [];

// Seed Orders
const INITIAL_ORDERS: Order[] = [];

// Seed Chat Messages
const INITIAL_MESSAGES: ChatMessage[] = [];

// Seed AI Recommendations
export const INITIAL_RECOMMENDATIONS: AIRecommendation[] = [];

// Initialize and Sync Storage
export const USE_DEMO_DATA = false;

const MOCK_ID_REGEX = /^(p[1-9]|inv-[1-9]|ord-[1-9]|lc-[1-9]|mov-[1-9]|pay-[1-9]|msg-[1-9]|rec-[1-9]|u[1-9]|user-1|user-2|user-3|user-4|user-5|demo-)/i;

export function filterMockData<T extends { id?: string; uid?: string }>(data: T[]): T[] {
  if (USE_DEMO_DATA) return data;
  if (!Array.isArray(data)) return [];
  return data.filter(item => {
    if (!item) return false;
    const itemId = item.id || item.uid;
    if (!itemId) return true;
    if (MOCK_ID_REGEX.test(itemId)) return false;
    return true;
  });
}

export function clearDemoData(): void {
  try {
    const keys = [
      "wakat_erp_v2_users",
      "wakat_erp_v2_products",
      "wakat_erp_v2_inventory",
      "wakat_erp_v2_orders",
      "wakat_erp_v2_messages",
      "wakat_erp_v2_recommendations",
      "wakat_erp_v2_light_clients",
      "wakat_erp_v2_stock_movements",
      "wakat_erp_v2_payments",
      "wakat_erp_v2_connections",
      "wakat_erp_v2_notifications"
    ];

    keys.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            const cleaned = items.filter(item => {
              const id = item?.id || item?.uid;
              if (!id) return true;
              return !MOCK_ID_REGEX.test(id);
            });
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        } catch (e) {}
      }
    });

    const statsRaw = localStorage.getItem("wakat_erp_v2_platform_stats");
    if (statsRaw) {
      try {
        const stats = JSON.parse(statsRaw);
        if (stats) {
          stats.totalRevenue = 0;
          stats.totalOrdersCount = 0;
          stats.activeUsersCount = {
            manufacturers: 0,
            wholesalers: 0,
            semiWholesalers: 0,
            retailers: 0,
            drivers: 0,
            clients: 0,
          };
          localStorage.setItem("wakat_erp_v2_platform_stats", JSON.stringify(stats));
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error("Error clearing demo data:", e);
  }
}

if (typeof window !== "undefined" && !USE_DEMO_DATA) {
  clearDemoData();
}

class ERPStorage {
  private get<T>(key: string, defaults: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
      return defaults;
    } catch {
      return defaults;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
  }

  getUsers(): UserProfile[] {
    const loaded = filterMockData(this.get<UserProfile[]>("wakat_erp_v2_users", USE_DEMO_DATA ? INITIAL_USERS : []));
    const userMap = new Map<string, UserProfile>();
    
    const initial = USE_DEMO_DATA ? INITIAL_USERS : [];
    
    [...initial, ...loaded].forEach(u => {
      if (u && u.id) {
        userMap.set(u.id, u);
      }
    });

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("wakat_fb_users_v2_")) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed && (parsed.uid || parsed.email)) {
              const uid = parsed.uid || parsed.email;
              if (uid) {
                const profile: UserProfile = {
                  id: uid,
                  name: `${parsed.prénom || ""} ${parsed.nom || ""}`.trim() || parsed.email?.split("@")[0] || "Utilisateur",
                  email: parsed.email || "",
                  phone: parsed.téléphone || "",
                  role: (parsed.rôle as UserRole) || UserRole.CLIENT,
                  status: (parsed.statut as any) || "ACTIVE",
                  country: parsed.pays || "Burkina Faso",
                  region: parsed.ville || "Ouagadougou",
                  sector: parsed.quartier,
                  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
                  balance: 0,
                  companyName: `${parsed.nom || parsed.email?.split("@")[0] || "Entreprise"} Entreprise`,
                  address: parsed.ville && parsed.quartier ? `${parsed.quartier}, ${parsed.ville}` : "Non spécifié"
                };
                userMap.set(uid, profile);
              }
            }
          }
        }
      }
    } catch (e) {}

    const result = Array.from(userMap.values());
    return result;
  }

  saveUsers(users: UserProfile[]): void {
    this.set("wakat_erp_v2_users", users);
  }

  getProducts(): Product[] {
    return filterMockData(this.get("wakat_erp_v2_products", USE_DEMO_DATA ? INITIAL_PRODUCTS : []));
  }

  saveProducts(products: Product[]): void {
    this.set("wakat_erp_v2_products", products);
  }

  getInventory(): InventoryItem[] {
    return filterMockData(this.get("wakat_erp_v2_inventory", USE_DEMO_DATA ? INITIAL_INVENTORY : []));
  }

  saveInventory(inventory: InventoryItem[]): void {
    this.set("wakat_erp_v2_inventory", inventory);
  }

  getOrders(): Order[] {
    return filterMockData(this.get("wakat_erp_v2_orders", USE_DEMO_DATA ? INITIAL_ORDERS : []));
  }

  saveOrders(orders: Order[]): void {
    this.set("wakat_erp_v2_orders", orders);
  }

  getMessages(): ChatMessage[] {
    return filterMockData(this.get("wakat_erp_v2_messages", USE_DEMO_DATA ? INITIAL_MESSAGES : []));
  }

  saveMessages(messages: ChatMessage[]): void {
    this.set("wakat_erp_v2_messages", messages);
  }

  getRecommendations(): AIRecommendation[] {
    return filterMockData(this.get("wakat_erp_v2_recommendations", USE_DEMO_DATA ? INITIAL_RECOMMENDATIONS : []));
  }

  saveRecommendations(recs: AIRecommendation[]): void {
    this.set("wakat_erp_v2_recommendations", recs);
  }

  getPlatformStats(): PlatformStats {
    const defaultStats: PlatformStats = {
      commissionRate: 5.0, // 5%
      totalRevenue: USE_DEMO_DATA ? 4135550 : 0, // CFA
      totalOrdersCount: USE_DEMO_DATA ? INITIAL_ORDERS.length : 0,
      activeUsersCount: USE_DEMO_DATA ? {
        manufacturers: 2,
        wholesalers: 2,
        semiWholesalers: 1,
        retailers: 2,
        drivers: 3,
        clients: 2,
      } : {
        manufacturers: 0,
        wholesalers: 0,
        semiWholesalers: 0,
        retailers: 0,
        drivers: 0,
        clients: 0,
      },
    };
    return this.get("wakat_erp_v2_platform_stats", defaultStats);
  }

  savePlatformStats(stats: PlatformStats): void {
    this.set("wakat_erp_v2_platform_stats", stats);
  }

  // --- New Entities ---
  getLightClients(): LightClient[] {
    return filterMockData(this.get("wakat_erp_v2_light_clients", USE_DEMO_DATA ? INITIAL_LIGHT_CLIENTS : []));
  }

  saveLightClients(clients: LightClient[]): void {
    this.set("wakat_erp_v2_light_clients", clients);
  }

  getStockMovements(): StockMovement[] {
    return filterMockData(this.get("wakat_erp_v2_stock_movements", USE_DEMO_DATA ? INITIAL_MOVEMENTS : []));
  }

  saveStockMovements(movements: StockMovement[]): void {
    this.set("wakat_erp_v2_stock_movements", movements);
  }

  getPayments(): DebtPayment[] {
    return filterMockData(this.get("wakat_erp_v2_payments", USE_DEMO_DATA ? INITIAL_PAYMENTS : []));
  }

  savePayments(payments: DebtPayment[]): void {
    this.set("wakat_erp_v2_payments", payments);
  }

  getConnections(): Connection[] {
    return this.get("wakat_erp_v2_connections", []);
  }

  saveConnections(connections: Connection[]): void {
    this.set("wakat_erp_v2_connections", connections);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_connections_updated", { detail: connections }));
    }
  }

  getNotifications(): Notification[] {
    return this.get("wakat_erp_v2_notifications", []);
  }

  saveNotifications(notifications: Notification[]): void {
    this.set("wakat_erp_v2_notifications", notifications);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated", { detail: notifications }));
    }
  }

  getSyncQueue(): any[] {
    return this.get("wakat_erp_v2_sync_queue", []);
  }

  saveSyncQueue(queue: any[]): void {
    this.set("wakat_erp_v2_sync_queue", queue);
  }

  // Reset helper
  resetAll(): void {
    localStorage.removeItem("wakat_erp_v2_users");
    localStorage.removeItem("wakat_erp_v2_products");
    localStorage.removeItem("wakat_erp_v2_inventory");
    localStorage.removeItem("wakat_erp_v2_orders");
    localStorage.removeItem("wakat_erp_v2_messages");
    localStorage.removeItem("wakat_erp_v2_recommendations");
    localStorage.removeItem("wakat_erp_v2_platform_stats");
    window.location.reload();
  }
}

export const db = new ERPStorage();

// Geography Helper functions
export function getGeoHierarchy(nodeId: string): string {
  const nodes: GeoNode[] = [];
  let current = MOCK_GEOGRAPHY.find((n) => n.id === nodeId);
  while (current) {
    nodes.unshift(current);
    const parentId = current.parentId;
    current = parentId ? MOCK_GEOGRAPHY.find((n) => n.id === parentId) : undefined;
  }
  return nodes.map((n) => n.name).join(" > ");
}

// Haversine/Linear-based distance and travel-time estimator for our premium tracking
export function estimateShipping(
  fromLabel: string,
  toLabel: string
): { distance: number; time: number; fee: number } {
  const fromCoord = REGION_COORDINATES[fromLabel] || REGION_COORDINATES["Abidjan"];
  const toCoord = REGION_COORDINATES[toLabel] || REGION_COORDINATES["Cocody"];

  // Haversine-ish calculation
  const R = 6371; // Earth radius in km
  const dLat = ((toCoord.lat - fromCoord.lat) * Math.PI) / 180;
  const dLng = ((toCoord.lng - fromCoord.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromCoord.lat * Math.PI) / 180) *
      Math.cos((toCoord.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let distance = Math.round(R * c * 10) / 10;

  if (distance === 0) {
    distance = 1.5; // default fallback minimal distance
  }

  // Speed in African urban areas is approx 25-35 km/h
  const time = Math.round((distance / 30) * 60) + 5; // hours to minutes + overhead

  // Shipping fee in CFA (approx 500 CFA per km + 1000 CFA base)
  const fee = Math.round((distance * 500 + 1000) / 100) * 100;

  return { distance, time, fee };
}

// Generate dynamic AI Recommendations based on actual local stocks
export function triggerAIAnalysis(inventory: InventoryItem[], products: Product[]): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];

  // 1. Look for stock ruptures
  inventory.forEach((item) => {
    if (item.stock === 0) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        recommendations.push({
          id: `ai-rupture-${item.id}`,
          type: "RESTOCK",
          targetId: item.productId,
          title: `Rupture Critique : ${prod.name}`,
          description: `Votre stock est épuisé. La tendance de vente de ${prod.brand} dans votre commune est élevée. Nous vous recommandons de réapprovisionner immédiatement.`,
          confidence: 95,
          suggestedAction: `Commander 50 unités de ${prod.name} immédiatement.`,
          metrics: {
            currentStock: 0,
            recommendedQty: 50,
            estimatedVentesGrowth: 15,
          },
        });
      }
    } else if (item.stock <= item.threshold) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        recommendations.push({
          id: `ai-threshold-${item.id}`,
          type: "RESTOCK",
          targetId: item.productId,
          title: `Réapprovisionnement Conseillé : ${prod.name}`,
          description: `Votre stock actuel (${item.stock}) a franchi le seuil critique de ${item.threshold}. Risque élevé de rupture sous 3 jours.`,
          confidence: 89,
          suggestedAction: `Commander 30 unités supplémentaires.`,
          metrics: {
            currentStock: item.stock,
            recommendedQty: 30,
            estimatedVentesGrowth: 8,
          },
        });
      }
    }
  });

  // 2. Add seasonal weather-based forecast
  // Real forecast logic would go here
  
  return recommendations;
}

// Generate OTP Code
export function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Format currency (CFA Francs / XOF)
export function formatCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  })
    .format(amount)
    .replace("XOF", "FCFA");
}

// Business Logic Helpers
export function calculateApplicablePrice(priceTiers: PriceTier[] | undefined, quantity: number, defaultPrice: number): number {
  if (!priceTiers || priceTiers.length === 0) return defaultPrice;
  
  // Sort tiers by quantity descending to find the highest reached tier
  const sortedTiers = [...priceTiers].sort((a, b) => b.minQuantity - a.minQuantity);
  const applicableTier = sortedTiers.find(tier => quantity >= tier.minQuantity);
  
  return applicableTier ? applicableTier.unitPrice : defaultPrice;
}

export function calculateClientDebt(clientId: string, orders: Order[], payments: DebtPayment[]): number {
  const clientOrders = orders.filter(o => o.clientId === clientId);
  const totalOrdered = clientOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  
  const clientPayments = payments.filter(p => p.clientId === clientId);
  const totalPaid = clientPayments.reduce((sum, p) => sum + p.amount, 0);
  
  return totalOrdered - totalPaid;
}
