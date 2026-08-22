import { UserProfile, Product, InventoryItem, Order, Relation } from "../types";

// PROFILES MAPPER
export function profileToDb(user: Partial<UserProfile> & { logoUrl?: string }): Record<string, any> {
  const dbRecord: Record<string, any> = {};
  if (user.id !== undefined) dbRecord.id = user.id;
  if (user.email !== undefined) dbRecord.email = user.email;

  if (user.name !== undefined || user.companyName !== undefined) {
    const fullName = (user.companyName || user.name || "").trim();
    const parts = fullName.split(" ");
    dbRecord.nom = parts[0] || fullName || "Utilisateur";
    dbRecord.prenom = parts.slice(1).join(" ") || "";
  }

  if (user.phone !== undefined) dbRecord.telephone = user.phone;
  if (user.address !== undefined) dbRecord.address = user.address;
  if (user.region !== undefined) dbRecord.ville = user.region;
  if (user.country !== undefined) dbRecord.pays = user.country;
  if (user.role !== undefined) dbRecord.role = user.role;
  if (user.avatar !== undefined || user.logoUrl !== undefined) {
    dbRecord.avatar = user.avatar || user.logoUrl;
  }
  if (user.creditLimit !== undefined) dbRecord.limite_credit = user.creditLimit;

  return dbRecord;
}

export function profileFromDb(row: any): UserProfile {
  const fullName = [row.nom, row.prenom].filter(Boolean).join(" ").trim() || "Utilisateur";
  return {
    id: row.id,
    email: row.email || "",
    name: fullName,
    companyName: fullName,
    phone: row.telephone || "",
    role: row.role || "RETAILER",
    status: "ACTIVE",
    address: row.address || "",
    region: row.ville || "",
    country: row.pays || "Burkina Faso",
    avatar: row.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    balance: 0,
    creditLimit: row.limite_credit || 0
  };
}

// RELATIONS MAPPER
export function relationToDb(rel: Partial<Relation> & { senderId?: string; receiverId?: string; grossiste_id?: string; client_id?: string; status?: string; statut?: string; createdAt?: string; dateCreation?: string }): Record<string, any> {
  const dbRecord: Record<string, any> = {};
  if (rel.id !== undefined) dbRecord.id = rel.id;
  dbRecord.grossiste_id = rel.grossiste_id || rel.senderId || (rel as any).demandeurId || "";
  dbRecord.client_id = rel.client_id || rel.receiverId || (rel as any).destinataireId || "";
  
  const rawStatut = rel.statut || rel.status || "ACTIF";
  if (rawStatut === "active" || rawStatut === "actif" || rawStatut === "ACTIF") {
    dbRecord.statut = "ACTIF";
  } else if (rawStatut === "bloque" || rawStatut === "blocked" || rawStatut === "refuse" || rawStatut === "BLOCKED") {
    dbRecord.statut = "BLOCKED";
  } else {
    dbRecord.statut = "EN_ATTENTE";
  }

  const createdAt = rel.createdAt || (rel as any).dateCreation || (rel as any).created_at;
  if (createdAt) {
    dbRecord.created_at = createdAt;
  }

  return dbRecord;
}

export function relationFromDb(row: any): Relation {
  const rawStatut = String(row.statut || row.status || "").toUpperCase();
  const statutMapped = rawStatut === "ACTIF" || rawStatut === "ACTIVE" ? "actif" : (rawStatut === "BLOCKED" || rawStatut === "BLOQUE" || rawStatut === "REFUSE" ? "refuse" : "en_attente");

  const senderId = row.grossiste_id || row.sender_id || "";
  const receiverId = row.client_id || row.receiver_id || "";

  return {
    id: row.id,
    demandeurId: senderId,
    destinataireId: receiverId,
    statut: statutMapped as any,
    dateCreation: row.created_at || new Date().toISOString(),
    participants: [senderId, receiverId].filter(Boolean)
  };
}

// PRODUCTS MAPPER
export function productToDb(p: Partial<Product> & { basePrice?: number; imageStoragePath?: string; updatedAt?: string }): Record<string, any> {
  const dbRecord: Record<string, any> = {};
  if (p.id !== undefined) dbRecord.id = p.id;
  if (p.name !== undefined) dbRecord.name = p.name;
  if (p.description !== undefined) dbRecord.description = p.description || "";
  if (p.category !== undefined) dbRecord.category = p.category || "Divers";
  if (p.subCategory !== undefined) dbRecord.sub_category = p.subCategory || "";
  if (p.brand !== undefined) dbRecord.brand = p.brand || "";
  if (p.unit !== undefined) dbRecord.unit = p.unit || "Unité";
  if (p.creatorId !== undefined) dbRecord.creator_id = p.creatorId;
  if (p.prixGros !== undefined) dbRecord.prix_gros = p.prixGros;
  if (p.prixDetail !== undefined) dbRecord.prix_detail = p.prixDetail;
  if (p.basePrice !== undefined) dbRecord.base_price = p.basePrice;
  if (p.quantiteMinimum !== undefined) dbRecord.quantite_minimum = p.quantiteMinimum;
  if (p.image !== undefined) dbRecord.image = p.image;
  if (p.imageUrl !== undefined) dbRecord.image_url = p.imageUrl;
  if (p.imageStoragePath !== undefined) dbRecord.image_storage_path = p.imageStoragePath;
  if (p.barcode !== undefined) dbRecord.barcode = p.barcode;
  if (p.qrCode !== undefined) dbRecord.qr_code = p.qrCode;
  if (p.weight !== undefined) dbRecord.weight = p.weight;
  if (p.volume !== undefined) dbRecord.volume = p.volume;
  if (p.expirationDate !== undefined) dbRecord.expiration_date = p.expirationDate;
  if (p.updatedAt !== undefined) dbRecord.updated_at = p.updatedAt;
  return dbRecord;
}

export function productFromDb(row: any): Product {
  return {
    id: row.id,
    name: row.name || "Produit",
    description: row.description || "",
    category: row.category || "Divers",
    subCategory: row.sub_category || "",
    brand: row.brand || "",
    unit: row.unit || "Unité",
    creatorId: row.creator_id || "",
    prixGros: row.prix_gros || 0,
    prixDetail: row.prix_detail || 0,
    quantiteMinimum: row.quantite_minimum || 1,
    image: row.image || row.image_url || "",
    imageUrl: row.image_url || row.image || "",
    barcode: row.barcode || "",
    qrCode: row.qr_code || "",
    weight: row.weight || 0,
    volume: row.volume || 0,
    expirationDate: row.expiration_date || ""
  };
}

// INVENTORY MAPPER
export function inventoryToDb(item: Partial<InventoryItem>): Record<string, any> {
  const dbRecord: Record<string, any> = {};
  if (item.id !== undefined) dbRecord.id = item.id;
  if (item.productId !== undefined) dbRecord.product_id = item.productId;
  if (item.ownerId !== undefined) dbRecord.owner_id = item.ownerId;
  if (item.stock !== undefined) dbRecord.stock = item.stock;
  if (item.threshold !== undefined) dbRecord.threshold = item.threshold;
  if (item.price !== undefined) dbRecord.price = item.price;
  if (item.prixGros !== undefined) dbRecord.prix_gros = item.prixGros;
  if (item.prixDetail !== undefined) dbRecord.prix_detail = item.prixDetail;
  if (item.quantiteMinimum !== undefined) dbRecord.quantite_minimum = item.quantiteMinimum;
  if (item.expirationDate !== undefined) dbRecord.expiration_date = item.expirationDate;
  if (item.updatedAt !== undefined) dbRecord.updated_at = item.updatedAt;
  return dbRecord;
}

export function inventoryFromDb(row: any): InventoryItem {
  return {
    id: row.id,
    productId: row.product_id,
    ownerId: row.owner_id,
    stock: row.stock || 0,
    threshold: row.threshold || 10,
    price: row.price || 0,
    prixGros: row.prix_gros || 0,
    prixDetail: row.prix_detail || 0,
    quantiteMinimum: row.quantite_minimum || 1,
    expirationDate: row.expiration_date || "",
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

// VENTES MAPPER
export function venteToDb(v: any): Record<string, any> {
  const dbRecord: Record<string, any> = {};
  if (v.id !== undefined) dbRecord.id = v.id;
  if (v.vendeurId !== undefined || v.vendeur_id !== undefined) dbRecord.vendeur_id = v.vendeurId || v.vendeur_id;
  if (v.vendeurNom !== undefined || v.vendeur_nom !== undefined) dbRecord.vendeur_nom = v.vendeurNom || v.vendeur_nom || "Commerçant";
  if (v.acheteurId !== undefined || v.acheteur_id !== undefined) dbRecord.acheteur_id = v.acheteurId || v.acheteur_id || "CLIENT_ANONYME";
  if (v.acheteurNom !== undefined || v.acheteur_nom !== undefined) dbRecord.acheteur_nom = v.acheteurNom || v.acheteur_nom || "Client";
  if (v.total !== undefined) dbRecord.total = v.total;
  if (v.modePaiement !== undefined || v.mode_paiement !== undefined || v.paymentMethod !== undefined) {
    dbRecord.mode_paiement = v.modePaiement || v.mode_paiement || v.paymentMethod || "CASH";
  }
  if (v.statut !== undefined) dbRecord.statut = v.statut || "COMPLETE";
  if (v.createdAt !== undefined || v.created_at !== undefined) dbRecord.created_at = v.createdAt || v.created_at || new Date().toISOString();
  return dbRecord;
}

export function venteFromDb(row: any): any {
  return {
    id: row.id,
    vendeurId: row.vendeur_id || "",
    vendeurNom: row.vendeur_nom || "",
    acheteurId: row.acheteur_id || "",
    acheteurNom: row.acheteur_nom || "",
    total: row.total || 0,
    modePaiement: row.mode_paiement || "CASH",
    statut: row.statut || "COMPLETE",
    createdAt: row.created_at || new Date().toISOString()
  };
}

// ORDERS MAPPER
export function orderToDb(o: Partial<Order> & { senderName?: string; receiverName?: string; total?: number }): Record<string, any> {
  const dbRecord: Record<string, any> = {};
  if (o.id !== undefined) dbRecord.id = o.id;
  if (o.senderId !== undefined) dbRecord.sender_id = o.senderId;
  if (o.senderName !== undefined) dbRecord.sender_name = o.senderName;
  if (o.receiverId !== undefined) dbRecord.receiver_id = o.receiverId;
  if (o.receiverName !== undefined) dbRecord.receiver_name = o.receiverName;
  if (o.totalAmount !== undefined || o.total !== undefined) {
    dbRecord.total = o.totalAmount ?? o.total ?? 0;
  }
  if (o.status !== undefined) dbRecord.status = o.status;
  if (o.items !== undefined) dbRecord.items = typeof o.items === "string" ? o.items : JSON.stringify(o.items);
  if (o.createdAt !== undefined) dbRecord.created_at = o.createdAt;
  return dbRecord;
}

export function orderFromDb(row: any): Order {
  let parsedItems = [];
  if (Array.isArray(row.items)) {
    parsedItems = row.items;
  } else if (typeof row.items === "string") {
    try { parsedItems = JSON.parse(row.items); } catch (e) { parsedItems = []; }
  }

  return {
    id: row.id,
    senderId: row.sender_id || "",
    receiverId: row.receiver_id || "",
    totalAmount: row.total || 0,
    status: row.status || "PENDING",
    items: parsedItems,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.created_at || new Date().toISOString(),
    orderType: "B2B_M2W",
    amountPaid: row.total || 0,
    paymentStatus: "PENDING",
    shippingFee: 0,
    distanceKm: 0,
    estimatedTimeMins: 0,
    paymentMethod: "CASH",
    deliveryAddress: ""
  };
}

