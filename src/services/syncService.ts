import { supabase } from "../supabase";
import { offlineStorage } from "./offlineStorage";

export type EntityType = "product" | "inventory" | "order" | "profile" | "relation" | "payment" | "lightClient";
export type OperationType = "CREATE" | "UPDATE" | "DELETE";

export interface SyncOperation {
  id: string;
  entity: EntityType;
  entityId: string;
  operation: OperationType;
  payload: any;
  dependsOn?: string; // ID of prerequisite operation
  timestamp: string;
  retryCount: number;
  maxRetries?: number;
  status: "pending" | "syncing" | "failed" | "completed";
  lastError?: {
    message: string;
    code?: string;
    details?: any;
    timestamp: string;
  };
}

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncTime?: string;
  lastError?: string;
}

type SyncListener = (status: SyncEngineStatus, queue: SyncOperation[]) => void;

class SyncService {
  private queue: SyncOperation[] = [];
  private isSyncing = false;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncTime?: string;
  private lastError?: string;
  private syncInterval: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Load persisted queue from offline storage
    try {
      this.queue = await offlineStorage.getAll<SyncOperation>("sync_queue");
      console.log(`[Offline Queue] ${this.queue.length} opération(s) chargée(s) depuis le stockage local.`);
    } catch (e) {
      console.warn("[Offline Queue] Impossible de charger la file d'attente locale:", e);
      this.queue = [];
    }

    // Set up network listeners
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        console.log("[Sync Engine] Événement réseau 'online' détecté.");
        this.checkRealConnectivityAndSync();
      });

      window.addEventListener("offline", () => {
        console.log("[Sync Engine] Événement réseau 'offline' détecté.");
        this.isOnline = false;
        this.notifyListeners();
      });

      // Periodic check every 30 seconds
      this.syncInterval = setInterval(() => {
        if (this.queue.length > 0 && !this.isSyncing) {
          this.checkRealConnectivityAndSync();
        }
      }, 30000);
    }

    // Initial check
    setTimeout(() => this.checkRealConnectivityAndSync(), 1500);
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus(), this.getQueue());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const status = this.getStatus();
    const queue = this.getQueue();
    this.listeners.forEach((l) => l(status, queue));
  }

  public getStatus(): SyncEngineStatus {
    const pendingCount = this.queue.filter((op) => op.status === "pending" || op.status === "syncing").length;
    const failedCount = this.queue.filter((op) => op.status === "failed").length;
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      failedCount,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError
    };
  }

  public getQueue(): SyncOperation[] {
    return [...this.queue];
  }

  /**
   * Vérifie la connectivité réelle à Supabase via un appel léger
   */
  public async checkRealConnectivity(): Promise<boolean> {
    if (!supabase) return false;
    try {
      // Test ping léger sur la table products avec timeout de 5 secondes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const { error } = await supabase.from("products").select("id").limit(1).abortSignal(controller.signal);
      clearTimeout(timeoutId);

      this.isOnline = !error || (error && error.code !== "PGRST301" && error.message !== "Failed to fetch");
      return this.isOnline;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Ajoute une opération dans la SyncQueue et persiste dans le stockage local
   */
  public async enqueue(
    entity: EntityType,
    entityId: string,
    operation: OperationType,
    payload: any,
    dependsOn?: string
  ): Promise<SyncOperation> {
    // Vérifier si une opération similaire est déjà en attente (déduplication / merge)
    const existingIndex = this.queue.findIndex(
      (op) => op.entity === entity && op.entityId === entityId && op.status === "pending"
    );

    let op: SyncOperation;

    if (existingIndex >= 0 && operation === "UPDATE" && this.queue[existingIndex].operation === "UPDATE") {
      // Fusionner le payload
      op = {
        ...this.queue[existingIndex],
        payload: { ...this.queue[existingIndex].payload, ...payload },
        timestamp: new Date().toISOString()
      };
      this.queue[existingIndex] = op;
      console.log(`[Offline Queue] Opération fusionnée pour ${entity} #${entityId}`);
    } else {
      op = {
        id: `sync_op_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        entity,
        entityId,
        operation,
        payload,
        dependsOn,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 5,
        status: "pending"
      };
      this.queue.push(op);
      console.log(`[Offline Queue] Nouvelle opération enregistrée : ${operation} ${entity} #${entityId}`, {
        opId: op.id,
        dependsOn
      });
    }

    await offlineStorage.setItem("sync_queue", op);
    this.notifyListeners();

    // Déclencher immédiatement la synchronisation si le réseau est accessible
    this.triggerSync();

    return op;
  }

  /**
   * Déclenche la synchronisation automatique si possible
   */
  public async triggerSync(): Promise<void> {
    if (this.isSyncing) return;
    await this.checkRealConnectivityAndSync();
  }

  /**
   * Forcer un re-jeu de toutes les opérations échouées
   */
  public async retryFailedOperations(): Promise<void> {
    this.queue.forEach((op) => {
      if (op.status === "failed") {
        op.status = "pending";
        op.retryCount = 0;
      }
    });
    await offlineStorage.setItems("sync_queue", this.queue);
    this.notifyListeners();
    await this.checkRealConnectivityAndSync();
  }

  private async checkRealConnectivityAndSync() {
    if (this.isSyncing) return;
    const online = await this.checkRealConnectivity();
    this.notifyListeners();
    if (online && this.queue.length > 0) {
      await this.processQueue();
    }
  }

  /**
   * Traitement ordonnancé et séquentiel de la file d'attente
   */
  private async processQueue() {
    if (this.isSyncing || this.queue.length === 0) return;

    this.isSyncing = true;
    this.notifyListeners();
    console.log(`[Sync Engine] Démarrage de la synchronisation de ${this.queue.length} opération(s)...`);

    try {
      // Créer une copie ordonnée :
      // 1. Les dépendances d'abord (e.g. PRODUCT avant INVENTORY)
      // 2. Ordre chronologique
      const completedOpIds = new Set<string>();

      // Boucle tant qu'il y a des opérations 'pending' prêtes à être exécutées
      let hasProgress = true;
      while (hasProgress) {
        hasProgress = false;

        const candidateOps = this.queue.filter((op) => {
          if (op.status !== "pending") return false;
          if (op.dependsOn && !completedOpIds.has(op.dependsOn)) {
            // Vérifier si la dépendance est encore dans la file
            const depExistsInQueue = this.queue.some((other) => other.id === op.dependsOn);
            if (depExistsInQueue) {
              return false; // Attendre que la dépendance soit terminée
            }
          }
          return true;
        });

        if (candidateOps.length === 0) break;

        for (const op of candidateOps) {
          op.status = "syncing";
          this.notifyListeners();

          console.log(`[Sync Engine] Exécution de l'opération ${op.id} (${op.operation} ${op.entity} #${op.entityId})...`);

          const success = await this.executeOperation(op);

          if (success) {
            console.log(`[Sync Engine] Opération ${op.id} synchronisée avec SUCCÈS sur Supabase.`);
            completedOpIds.add(op.id);
            // Supprimer de la file locale
            this.queue = this.queue.filter((item) => item.id !== op.id);
            await offlineStorage.removeItem("sync_queue", op.id);
            hasProgress = true;
            this.lastSyncTime = new Date().toISOString();
          } else {
            op.status = "failed";
            op.retryCount += 1;
            console.warn(`[Sync Engine] Échec de l'opération ${op.id} (Tentative ${op.retryCount}/${op.maxRetries || 5})`);
            await offlineStorage.setItem("sync_queue", op);
          }

          this.notifyListeners();
        }
      }
    } catch (e: any) {
      console.error("[Sync Engine] Erreur globale de synchronisation:", e);
      this.lastError = e.message || String(e);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
      console.log(`[Sync Engine] Fin du cycle de synchronisation. Opérations restantes : ${this.queue.length}`);
    }
  }

  /**
   * Exécution d'une opération atomique vers Supabase selon le schéma officiel
   */
  private async executeOperation(op: SyncOperation): Promise<boolean> {
    if (!supabase) {
      op.lastError = { message: "Supabase non initialisé", timestamp: new Date().toISOString() };
      return false;
    }

    try {
      switch (op.entity) {
        case "product":
          return await this.syncProduct(op);
        case "inventory":
          return await this.syncInventory(op);
        case "order":
          return await this.syncOrder(op);
        case "profile":
          return await this.syncProfile(op);
        case "relation":
          return await this.syncRelation(op);
        default:
          console.warn(`[Sync Engine] Entité non supportée pour le moment : ${op.entity}`);
          return true; // Ne pas bloquer la file pour les entités secondaires
      }
    } catch (e: any) {
      op.lastError = {
        message: e.message || "Erreur inconnue",
        code: e.code,
        details: e.details,
        timestamp: new Date().toISOString()
      };
      console.error("[Sync Error]", {
        operationId: op.id,
        entity: op.entity,
        entityId: op.entityId,
        payload: op.payload,
        error: e
      });
      return false;
    }
  }

  // --- Synchroniseurs par table Supabase ---

  private async syncProduct(op: SyncOperation): Promise<boolean> {
    const { operation, payload } = op;
    if (operation === "DELETE") {
      const { error } = await supabase.from("products").delete().eq("id", op.entityId);
      if (error) throw error;
      return true;
    }

    // CREATE ou UPDATE
    const record = {
      id: payload.id,
      name: payload.name,
      description: payload.description || "",
      category: payload.category || "Général",
      sub_category: payload.subCategory || null,
      brand: payload.brand || "Générique",
      unit: payload.unit || "Unité",
      weight: payload.weight ? Number(payload.weight) : 0,
      volume: payload.volume ? Number(payload.volume) : 0,
      creator_id: payload.creatorId || payload.creator_id,
      prix_gros: payload.prixGros !== undefined ? Number(payload.prixGros) : null,
      prix_detail: payload.prixDetail !== undefined ? Number(payload.prixDetail) : null,
      base_price: payload.basePrice !== undefined ? Number(payload.basePrice) : null,
      image: payload.image || "",
      image_url: payload.imageUrl || null,
      barcode: payload.barcode || null,
      qr_code: payload.qrCode || null,
      expiration_date: payload.expirationDate || null,
      quantite_minimum: payload.quantiteMinimum ? Number(payload.quantiteMinimum) : 1,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("products").upsert(record);
    if (error) throw error;
    return true;
  }

  private async syncInventory(op: SyncOperation): Promise<boolean> {
    const { operation, payload } = op;
    if (operation === "DELETE") {
      const { error } = await supabase.from("inventory").delete().eq("id", op.entityId);
      if (error) throw error;
      return true;
    }

    // Le schéma confirmé Supabase de public.inventory utilise 'stock'
    const record = {
      id: payload.id,
      product_id: payload.productId || payload.product_id,
      owner_id: payload.ownerId || payload.owner_id,
      stock: Number(payload.stock ?? payload.quantity ?? 0),
      threshold: Number(payload.threshold || 5),
      price: Number(payload.price || 0),
      prix_gros: payload.prixGros !== undefined ? Number(payload.prixGros) : null,
      prix_detail: payload.prixDetail !== undefined ? Number(payload.prixDetail) : null,
      quantite_minimum: payload.quantiteMinimum !== undefined ? Number(payload.quantiteMinimum) : 1,
      expiration_date: payload.expirationDate || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("inventory").upsert(record);
    if (error) throw error;
    return true;
  }

  private async syncOrder(op: SyncOperation): Promise<boolean> {
    const { operation, payload } = op;
    if (operation === "DELETE") {
      const { error } = await supabase.from("orders").delete().eq("id", op.entityId);
      if (error) throw error;
      return true;
    }

    const record = {
      id: payload.id,
      sender_id: payload.senderId || payload.sender_id,
      receiver_id: payload.receiverId || payload.receiver_id,
      status: payload.status,
      total: Number(payload.totalAmount ?? payload.total ?? 0),
      items: payload.items,
      created_at: payload.createdAt || new Date().toISOString()
    };

    const { error } = await supabase.from("orders").upsert(record);
    if (error) throw error;
    return true;
  }

  private async syncProfile(op: SyncOperation): Promise<boolean> {
    const { payload } = op;
    const record: any = {
      id: payload.id
    };
    if (payload.email) record.email = payload.email;
    if (payload.name) record.nom = payload.name;
    if (payload.phone) record.telephone = payload.phone;
    if (payload.role) record.role = payload.role;
    if (payload.address) record.address = payload.address;
    if (payload.avatar) record.avatar = payload.avatar;

    const { error } = await supabase.from("profiles").upsert(record);
    if (error) throw error;
    return true;
  }

  private async syncRelation(op: SyncOperation): Promise<boolean> {
    const { operation, payload } = op;
    if (operation === "DELETE") {
      const { error } = await supabase.from("relations").delete().eq("id", op.entityId);
      if (error) throw error;
      return true;
    }

    const record = {
      id: payload.id,
      sender_id: payload.senderId || payload.sender_id,
      receiver_id: payload.receiverId || payload.receiver_id,
      statut: payload.status || payload.statut || "PENDING",
      notes: payload.notes || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("relations").upsert(record);
    if (error) throw error;
    return true;
  }

  /**
   * Compatibility alias for legacy queue calls
   */
  public async addToQueue(type: string, payload: any): Promise<SyncOperation> {
    if (type === "CREATE_ORDER" || type === "UPDATE_ORDER") {
      return this.enqueue("order", payload.id || `order-${Date.now()}`, type === "CREATE_ORDER" ? "CREATE" : "UPDATE", payload);
    }
    if (type === "ADD_PAYMENT" || type === "PAYMENT") {
      return this.enqueue("payment", payload.id || `pay-${Date.now()}`, "CREATE", payload);
    }
    return this.enqueue("order", payload.id || `op-${Date.now()}`, "CREATE", payload);
  }
}

export const syncService = new SyncService();
