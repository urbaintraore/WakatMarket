/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = "ADMIN",
  MANUFACTURER = "MANUFACTURER",
  WHOLESALER = "WHOLESALER",
  SEMI_WHOLESALER = "SEMI_WHOLESALER", // Demi-Grossiste
  RETAILER = "RETAILER",
  CLIENT = "CLIENT",
  DRIVER_M2W = "DRIVER_M2W", // Fabricant -> Grossiste
  DRIVER_W2R = "DRIVER_W2R", // Grossiste -> Détaillant
  DRIVER_R2C = "DRIVER_R2C", // Détaillant -> Client
  DRIVER_W2SG = "DRIVER_W2SG", // Grossiste -> Demi-Grossiste
  DRIVER_SG2R = "DRIVER_SG2R", // Demi-Grossiste -> Détaillant
}

export function isBonkoungou(email?: string, companyName?: string, name?: string): boolean {
  if (!email && !companyName && !name) return false;
  const e = (email || "").toLowerCase().trim();
  const c = (companyName || "").toLowerCase().trim();
  const n = (name || "").toLowerCase().trim();
  return (
    e.includes("bonkoungou") ||
    e.includes("bonkougou") ||
    e.includes("sayouba") ||
    c.includes("bonkoungou") ||
    c.includes("bonkougou") ||
    n.includes("bonkoungou") ||
    n.includes("bonkougou") ||
    n.includes("sayouba")
  );
}

export function normalizeUserRole(inputRole?: string | UserRole | null): UserRole {
  if (!inputRole) return UserRole.CLIENT;
  const raw = String(inputRole).trim().toUpperCase();
  
  if (raw === UserRole.ADMIN || raw.includes("ADMIN")) return UserRole.ADMIN;
  if (raw === UserRole.MANUFACTURER || raw.includes("FABRICANT") || raw.includes("MANUFACTURER") || raw.includes("USINE")) return UserRole.MANUFACTURER;
  if (
    raw === UserRole.SEMI_WHOLESALER || 
    raw.includes("SEMI_WHOLESALER") || 
    raw.includes("SEMI-WHOLESALER") || 
    raw.includes("SEMI_GROSSISTE") || 
    raw.includes("SEMI-GROSSISTE") || 
    raw.includes("DEMIGROSSISTE") || 
    raw.includes("DEMI-GROSSISTE") || 
    raw.includes("DEMI_GROSSISTE") ||
    raw.includes("HALF_WHOLESALER") ||
    raw.includes("DEMI") || 
    raw.includes("SEMI")
  ) return UserRole.SEMI_WHOLESALER;
  if (raw === UserRole.WHOLESALER || raw.includes("WHOLESALER") || raw.includes("GROSSISTE")) return UserRole.WHOLESALER;
  if (raw === UserRole.RETAILER || raw.includes("RETAILER") || raw.includes("DETAILLANT") || raw.includes("DÉTAILLANT") || raw.includes("BOUTIQUE")) return UserRole.RETAILER;
  if (raw === UserRole.DRIVER_M2W || raw.includes("DRIVER_M2W") || raw.includes("M2W")) return UserRole.DRIVER_M2W;
  if (raw === UserRole.DRIVER_W2R || raw.includes("DRIVER_W2R") || raw.includes("W2R")) return UserRole.DRIVER_W2R;
  if (raw === UserRole.DRIVER_R2C || raw.includes("DRIVER_R2C") || raw.includes("R2C")) return UserRole.DRIVER_R2C;
  if (raw === UserRole.DRIVER_W2SG || raw.includes("DRIVER_W2SG") || raw.includes("W2SG")) return UserRole.DRIVER_W2SG;
  if (raw === UserRole.DRIVER_SG2R || raw.includes("DRIVER_SG2R") || raw.includes("SG2R")) return UserRole.DRIVER_SG2R;
  if (raw.includes("LIVREUR") || raw.includes("DRIVER")) return UserRole.DRIVER_R2C;
  if (raw === UserRole.CLIENT || raw.includes("CLIENT") || raw.includes("ACHETEUR") || raw.includes("CUSTOMER")) return UserRole.CLIENT;
  
  // Check exact match
  const allRoles = Object.values(UserRole);
  if (allRoles.includes(raw as UserRole)) return raw as UserRole;

  return UserRole.CLIENT;
}

export interface LightClient {
  id: string;
  ownerId: string; // The user (Manufacturer/Wholesaler/etc.) who owns this client entry
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  role?: UserRole | string;
  notes?: string;
  linkedUserId?: string; // Optional reference to a real UserProfile if they join the platform
  createdAt: string;
  creditLimit?: number; // Maximum allowed credit limit (in CFA)
}

export interface PriceTier {
  minQuantity: number;
  unitPrice: number;
  label: string; // e.g. "Détail", "Demi-Gros", "Gros", "Carton"
}

export interface StockMovement {
  id: string;
  productId: string;
  ownerId: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  reason: string;
  timestamp: string;
  orderId?: string; // Reference to order if type is OUT
  isSynced: boolean;
}

export interface DebtPayment {
  id: string;
  clientId: string;
  amount: number;
  date: string;
  saleId?: string; // Reference to the sale that generated the debt
  orderId?: string;
  method?: string;
  isSynced: boolean;
}

export interface NumeroPaiement {
  operateur: "Orange Money" | "Moov Money" | "Telecel Money" | string;
  numero: string;
  nomTitulaire: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  companyName?: string;
  avatar?: string;
  country: string;
  region: string;
  province?: string;
  commune?: string;
  sector?: string;
  address?: string;
  rating?: number;
  balance?: number;
  latitude?: number;
  longitude?: number;
  creditLimit?: number; // Maximum allowed credit limit (in CFA)
  numerosPaiement?: NumeroPaiement[];
}

export interface GeoLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface GeoNode {
  id: string;
  name: string;
  type: "PAYS" | "REGION" | "PROVINCE" | "COMMUNE" | "SECTEUR" | "QUARTIER";
  parentId?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  subCategory?: string;
  brand: string;
  unit: string; // e.g. "Carton de 24 bouteilles", "Sac de 50kg"
  weight: number; // in kg
  volume: number; // in m³
  image: string;
  imageUrl?: string;
  barcode: string;
  qrCode: string;
  expirationDate?: string;
  creatorId: string; // Manufacturer ID
  prixGros?: number;
  prixDetail?: number;
  quantiteMinimum?: number;
  typeVente?: "GROS" | "DETAIL" | "BOTH";
  priceTiers?: PriceTier[];
  lowStockThreshold?: number;
}

export interface InventoryItem {
  id: string;
  productId: string;
  ownerId: string; // Fabricant, Grossiste or Détaillant
  stock: number;
  threshold: number; // Critical threshold
  price: number; // Selling price
  expirationDate?: string;
  promoPrice?: number;
  promoEnds?: string;
  prixGros?: number;
  prixDetail?: number;
  quantiteMinimum?: number;
  typeVente?: "GROS" | "DETAIL" | "BOTH";
  updatedAt?: string;
  priceTiers?: PriceTier[];
  lowStockThreshold?: number;
}

export enum OrderStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING", // En attente
  CONFIRMED = "CONFIRMED", // Confirmée
  PREPARING = "PREPARING", // Préparation
  READY = "READY", // Prête
  SHIPPED = "SHIPPED", // Expédiée (départ validé)
  DELIVERING = "DELIVERING", // En livraison
  DELIVERED = "DELIVERED", // Livrée (réception confirmée)
  CANCELLED = "CANCELLED", // Annulée
  RETURNED = "RETURNED", // Retournée
}

export interface OrderItem {
  productId: string;
  quantity: number;
  priceAtOrder: number;
}

export interface Order {
  id: string;
  orderType: "B2B_M2W" | "B2B_W2R" | "B2C_R2C" | "B2B_W2SG" | "B2B_SG2R" | "B2C_SG2C"; // Add Wholesaler to Semi-Wholesaler, Semi-Wholesaler to Retailer, Semi-Wholesaler to Client
  senderId: string; // Wholesaler, Retailer, or Client
  receiverId: string; // Manufacturer, Wholesaler, or Retailer
  items: OrderItem[];
  totalAmount: number;
  amountPaid: number;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "PARTIAL" | "DEFERRED_APPROVED";
  status: OrderStatus;
  clientId?: string; // Reference to LightClient if B2C or offline client
  createdAt: string;
  updatedAt: string;
  shippingFee: number;
  distanceKm: number;
  estimatedTimeMins: number;
  paymentMethod: "ORANGE_MONEY" | "MOOV_MONEY" | "TELECEL_MONEY" | "WAVE" | "CREDIT_CARD" | "CASH" | "DEFERRED" | "MOBILE_MONEY" | "OTHER";
  deliveryAddress: string;
  deliveryNotes?: string;
  driverId?: string; // Assigned delivery driver
  otpCode?: string; // Driver authentication pin for B2C
  signatureImage?: string; // Digital signature png
  deliveryPhoto?: string; // Proof of delivery photo url
  claimMessage?: string; // Message from client regarding a claim
  claimStatus?: "NONE" | "OPEN" | "RESOLVED"; // Status of a claim
  sellerType?: string;
  buyerType?: string;
  canalDistribution?: string;

  // Flux de paiement manuel par capture d'écran (Mobile Money)
  statutPaiement?: "en_attente_preuve" | "preuve_soumise" | "valide" | "rejete";
  preuvePaiementUrl?: string | null;
  dateSoumissionPreuve?: string | any;
  dateValidationPaiement?: string | any;
  dateRejetPaiement?: string | any;
  commentaireRejet?: string | null;
  motifRejetPaiement?: string | null;
  numerosPaiementVendeur?: NumeroPaiement[];
  vendeurNumeros?: NumeroPaiement[];
}

export enum MessageType {
  TEXT = "TEXT",
  AUDIO = "AUDIO",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT",
  LOCATION = "LOCATION",
  SYSTEM = "SYSTEM"
}

export enum MessageStatus {
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ"
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  type?: MessageType;
  content?: string; // Texte, message système ou nom de fichier
  mediaUrl?: string; // Image, Video, Document
  audioUrl?: string; // Voice notes
  duration?: number; // Voice note duration in seconds
  latitude?: number; // Pour partage de position
  longitude?: number;
  status?: MessageStatus;
  createdAt?: string;
  readBy?: Record<string, string>; // userId -> timestamp de lecture
  replyToId?: string; // Pour les réponses
  senderName?: string;
  senderRole?: UserRole;
  text?: string;
  receiverId?: string;
  timestamp?: string;
  transcription?: string;
}

export interface ConversationParticipant {
  userId: string;
  joinedAt: string;
  role: "MEMBER" | "ADMIN";
}

export interface Conversation {
  id: string;
  type: "PRIVATE" | "GROUP";
  participants: string[]; // Liste simple pour requêtes rapides array-contains
  participantDetails: Record<string, ConversationParticipant>;
  lastMessage?: string;
  lastMessageDate?: string;
  unreadCount: Record<string, number>; // userId -> count
  
  // Pour les groupes
  groupName?: string;
  groupDescription?: string;
  groupImage?: string;
  createdBy?: string;

  // Contextes optionnels
  orderId?: string;
  productId?: string;
  deliveryId?: string;
  invoiceId?: string;
  paymentId?: string;

  createdAt: string;
  updatedAt: string;
}

export interface AIRecommendation {
  id: string;
  type: "RESTOCK" | "DEMAND_FORECAST" | "PROMOTION" | "ROUTE_OPTIMIZATION";
  targetId: string; // Product ID or Route ID
  title: string;
  description: string;
  confidence: number; // 0-100%
  suggestedAction: string;
  metrics?: {
    currentStock?: number;
    recommendedQty?: number;
    estimatedVentesGrowth?: number;
  };
}

export interface PlatformStats {
  commissionRate: number; // % taken by platform
  totalRevenue: number;
  totalOrdersCount: number;
  activeUsersCount: {
    manufacturers: number;
    wholesalers: number;
    semiWholesalers?: number; // Optional or required, let's keep it optional for compatibility but fully used
    retailers: number;
    drivers: number;
    clients: number;
  };
}

export interface LoyaltyPoints {
  userId: string;
  points: number;
  tier: "BRONZE" | "SILVER" | "GOLD";
}

export interface Connection {
  id: string;
  senderId: string;    // L'acteur qui demande l'ajout
  receiverId: string;  // Le client/partenaire concerné
  status: "en_attente" | "active" | "refusée";
  senderName: string;
  senderRole: UserRole;
  receiverName: string;
  receiverRole: UserRole;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  id: string; // Document ID: e.g. "demandeurId_destinataireId"
  demandeurId: string;
  destinataireId: string;
  statut: "en_attente" | "actif" | "refuse";
  dateCreation: any;
  dateReponse?: any;
  participants: string[]; // [demandeurId, destinataireId]
  notes?: string;
  demandeurNom?: string;
  demandeurRole?: string;
  destinataireNom?: string;
  destinataireRole?: string;
}

export interface PartnerNotificationItem {
  id: string;
  type: "demande_connexion" | "connexion_acceptee" | "connexion_refusee" | "preuve_paiement_a_valider" | "paiement_valide" | "paiement_rejete" | string;
  relationId?: string;
  venteId?: string;
  orderId?: string;
  factureUrl?: string;
  expediteurId?: string;
  lu: boolean;
  dateCreation: any;
  contenu: string;
}

export interface Notification {
  id: string;
  userId: string; // recipient
  senderId?: string; // sender of the notification
  title: string;
  message: string;
  type: "CONNECTION_REQUEST" | "CONNECTION_ACCEPTED" | "CONNECTION_REJECTED" | "MESSAGE" | "SYSTEM" | "demande_connexion" | "connexion_acceptee" | "connexion_refusee";
  read: boolean;
  createdAt: string;
  relatedId?: string; // e.g. Connection ID or Message ID
}

export function isConnectionActive(c: any): boolean {
  if (!c) return false;
  const status = (c.status || c.statut || "").toLowerCase();
  return status === "active" || status === "actif";
}
