/**
 * WakatMarket Offline Storage Service
 * Provides robust client-side persistence using IndexedDB with fallback to localStorage.
 */

const DB_NAME = "wakat_erp_offline_db";
const DB_VERSION = 1;
const STORES = [
  "products",
  "inventory",
  "orders",
  "profiles",
  "relations",
  "payments",
  "light_clients",
  "sync_queue"
];

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private isAvailable: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    if (typeof window === "undefined" || !window.indexedDB) {
      this.isAvailable = false;
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.warn("[OfflineStorage] IndexedDB non disponible, utilisation du fallback LocalStorage.");
          this.isAvailable = false;
          resolve();
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.isAvailable = true;
          resolve();
        };

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          STORES.forEach((storeName) => {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: "id" });
            }
          });
        };
      } catch (e) {
        console.warn("[OfflineStorage] Erreur initialisation IndexedDB:", e);
        this.isAvailable = false;
        resolve();
      }
    });
  }

  public async setItem<T extends { id: string }>(storeName: string, item: T): Promise<void> {
    await this.initPromise;
    if (this.isAvailable && this.db) {
      try {
        return new Promise((resolve, reject) => {
          const tx = this.db!.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.put(item);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn(`[OfflineStorage] Erreur écriture IndexedDB (${storeName}):`, e);
      }
    }

    // Fallback LocalStorage
    try {
      const key = `wakat_offline_${storeName}`;
      const existing = this.getFromLocalStorage<T>(key);
      const updated = [...existing.filter((x) => x.id !== item.id), item];
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn(`[OfflineStorage] Fallback LocalStorage failed for ${storeName}:`, e);
    }
  }

  public async setItems<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
    await this.initPromise;
    if (this.isAvailable && this.db) {
      try {
        return new Promise((resolve, reject) => {
          const tx = this.db!.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          store.clear();
          items.forEach((item) => store.put(item));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.warn(`[OfflineStorage] Erreur écriture multiple IndexedDB (${storeName}):`, e);
      }
    }

    // Fallback LocalStorage
    try {
      const key = `wakat_offline_${storeName}`;
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.warn(`[OfflineStorage] Fallback LocalStorage failed for setItems ${storeName}:`, e);
    }
  }

  public async getAll<T>(storeName: string): Promise<T[]> {
    await this.initPromise;
    if (this.isAvailable && this.db) {
      try {
        return new Promise((resolve) => {
          const tx = this.db!.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result || []) as T[]);
          req.onerror = () => {
            console.warn(`[OfflineStorage] Erreur lecture IndexedDB (${storeName}):`, req.error);
            resolve(this.getFromLocalStorage<T>(`wakat_offline_${storeName}`));
          };
        });
      } catch (e) {
        console.warn(`[OfflineStorage] Erreur get all ${storeName}:`, e);
      }
    }

    return this.getFromLocalStorage<T>(`wakat_offline_${storeName}`);
  }

  public async removeItem(storeName: string, id: string): Promise<void> {
    await this.initPromise;
    if (this.isAvailable && this.db) {
      try {
        return new Promise((resolve, reject) => {
          const tx = this.db!.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn(`[OfflineStorage] Erreur suppression IndexedDB (${storeName}):`, e);
      }
    }

    try {
      const key = `wakat_offline_${storeName}`;
      const existing = this.getFromLocalStorage<{ id: string }>(key);
      const updated = existing.filter((x) => x.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn(`[OfflineStorage] Fallback LocalStorage delete error for ${storeName}:`, e);
    }
  }

  public async clearStore(storeName: string): Promise<void> {
    await this.initPromise;
    if (this.isAvailable && this.db) {
      try {
        return new Promise((resolve) => {
          const tx = this.db!.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          store.clear();
          tx.oncomplete = () => resolve();
        });
      } catch (e) {
        console.warn(`[OfflineStorage] Erreur clear store ${storeName}:`, e);
      }
    }

    try {
      localStorage.removeItem(`wakat_offline_${storeName}`);
    } catch (e) {
      console.warn(`[OfflineStorage] Fallback LocalStorage clear error for ${storeName}:`, e);
    }
  }

  private getFromLocalStorage<T>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

export const offlineStorage = new OfflineStorage();
