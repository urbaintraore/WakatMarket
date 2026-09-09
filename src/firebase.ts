import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  type Firestore,
  type WhereFilterOp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || "").trim()
};

export let firebaseConfigError: string | null = null;

let firebaseApp: FirebaseApp | null = null;

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  firebaseConfigError =
    "Le projet Firebase n'est pas configuré. Renseignez les variables VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID et VITE_FIREBASE_APP_ID.";
} else {
  try {
    firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  } catch (err: any) {
    firebaseConfigError = `Erreur d'initialisation Firebase : ${err?.message || err}`;
    console.error("Firebase initialization failed:", err);
  }
}

export function isFirebaseConfigured(): boolean {
  return !!firebaseApp;
}

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    throw new Error(`Firebase n'est pas configuré. ${firebaseConfigError || ""}`);
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

/**
 * Détecte les erreurs réseau pour basculer en mode hors-ligne
 */
export function isNetworkError(err: any): boolean {
  if (!err) return false;
  if (typeof err === "string") {
    const s = err.toLowerCase();
    return s.includes("failed to fetch") || s.includes("network") || s.includes("abort") || s.includes("load failed") || s.includes("timeout") || s.includes("unavailable");
  }
  const rawMsg = [
    err?.message,
    err?.code,
    err?.name,
    err?.error,
    err?.statusText,
    String(err)
  ].filter(Boolean).join(" ").toLowerCase();

  return (
    err?.name === "TypeError" ||
    err?.code === "unavailable" ||
    rawMsg.includes("failed to fetch") ||
    rawMsg.includes("network") ||
    rawMsg.includes("typeerror") ||
    rawMsg.includes("abort") ||
    rawMsg.includes("load failed") ||
    rawMsg.includes("timeout") ||
    rawMsg.includes("connection refused")
  );
}

// --- Auth helpers -------------------------------------------------------

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  if (!firebaseApp) return () => {};
  return onAuthStateChanged(getFirebaseAuth(), (user) => callback(user));
}

export async function getAuthUser(): Promise<User | null> {
  if (!firebaseApp) return null;
  return getFirebaseAuth().currentUser;
}

// --- Firestore helpers ---------------------------------------------------
// Les documents sont écrits avec le même champ `id` et les mêmes noms de champs
// (snake_case) que l'ancien schéma PostgreSQL, pour conserver les mappers existants.

// --- Indicateur de lectures Firestore (diagnostic, aucun coût côté Google) --
// Compte les documents lus (getDocs/getDoc/onSnapshot) pour mesurer la
// consommation du quota Spark en direct dans la console : window.__wakatReads.
let readsTotal = 0;
function countReads(n: number): void {
  readsTotal += n > 0 ? n : 0;
  if (typeof window !== "undefined") {
    const w = window as unknown as { __wakatReads?: number };
    w.__wakatReads = (w.__wakatReads || 0) + (n > 0 ? n : 0);
  }
}
export function getReadsTotal(): number {
  return readsTotal;
}

export function rowFromDoc(docSnap: any): any {
  if (!docSnap?.exists()) return null;
  return { id: docSnap.id, ...(docSnap.data() || {}) };
}

export async function firestoreGetAll(collectionName: string): Promise<any[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, collectionName));
  countReads(snap.size);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

export async function firestoreGetById(collectionName: string, id: string): Promise<any | null> {
  if (!id) return null;
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, collectionName, id));
  countReads(snap.exists() ? 1 : 0);
  return rowFromDoc(snap);
}

export async function firestoreGetWhere(
  collectionName: string,
  field: string,
  op: WhereFilterOp,
  value: any
): Promise<any[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, collectionName), where(field, op, value));
  const snap = await getDocs(q);
  countReads(snap.size);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

export async function firestoreGetLimitOrdered(collectionName: string, orderField: string, limitCount: number = 500): Promise<any[]> {
  const db = getFirebaseDb();
  if (orderField) {
    const q = query(collection(db, collectionName), orderBy(orderField, "desc"), limit(limitCount));
    const snap = await getDocs(q);
    countReads(snap.size);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }
  const snap = await getDocs(collection(db, collectionName));
  countReads(snap.size);
  return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * Lecture paginée d'une collection par chunks (curseur startAfter).
 * Utile pour la découverte de partenaires au-delà des 500 premiers documents.
 */
export async function firestoreGetChunked(collectionName: string, orderField: string, pageSize: number = 500, maxPages: number = 4): Promise<any[]> {
  const db = getFirebaseDb();
  const out: any[] = [];
  let cursor: any = null;
  for (let page = 0; page < maxPages; page++) {
    const base = [collection(db, collectionName)];
    let qql = query(base[0], orderBy(orderField, "desc"), limit(pageSize));
    if (cursor) qql = query(base[0], orderBy(orderField, "desc"), startAfter(cursor), limit(pageSize));
    const snap = await getDocs(qql);
    countReads(snap.size);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    out.push(...rows);
    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return out;
}

/**
 * Upsert (merge) d'un document. Nécessite un champ id ou uid.
 */
export async function firestoreUpsert(collectionName: string, record: Record<string, any>): Promise<void> {
  const id = record.id || record.uid;
  if (!id) {
    throw new Error(`[Firestore] Impossible d'écrire dans '${collectionName}' sans identifiant (id/uid).`);
  }
  const db = getFirebaseDb();
  await setDoc(doc(db, collectionName, id), record, { merge: true });
}

export async function firestoreUpdate(collectionName: string, id: string, partial: Record<string, any>): Promise<void> {
  if (!id) return;
  const db = getFirebaseDb();
  await updateDoc(doc(db, collectionName, id), partial);
}

export async function firestoreDelete(collectionName: string, id: string): Promise<void> {
  if (!id) return;
  const db = getFirebaseDb();
  await deleteDoc(doc(db, collectionName, id));
}

export function firestoreSubscribe(collectionName: string, callback: (rows: any[]) => void): () => void {
  const db = getFirebaseDb();
  return onSnapshot(collection(db, collectionName), (snap) => {
    countReads(snap.size);
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
  });
}

export function firestoreSubscribeWhere(
  collectionName: string,
  field: string,
  op: WhereFilterOp,
  value: any,
  callback: (rows: any[]) => void
): () => void {
  const db = getFirebaseDb();
  const q = query(collection(db, collectionName), where(field, op, value));
  return onSnapshot(q, (snap) => {
    countReads(snap.size);
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
  });
}

// --- Abonnements temps réel partagés ---------------------------------------
// Un seul onSnapshot Firestore par flux (« kind »), partagé entre tous les
// composants par comptage de références. Économise les lectures dupliquées
// (App, CommonDashboardParts, NotificationBell, ChatLayout…). Le flux est mis
// en pause automatiquement quand l'onglet est masqué et repris à la visibilité.

type SharedListener = (rows: any[]) => void;
interface SharedChannel {
  count: number;
  listeners: Set<SharedListener>;
  unsubscribe: (() => void) | null;
  visibilityHandler: (() => void) | null;
}

const sharedChannels = new Map<string, SharedChannel>();

export function subscribeSharedFirestore(
  kind: string,
  buildQuery: (emit: SharedListener) => (() => void) | void,
  callback: SharedListener
): () => void {
  let channel = sharedChannels.get(kind);
  if (!channel) {
    channel = { count: 0, listeners: new Set(), unsubscribe: null, visibilityHandler: null };
    sharedChannels.set(kind, channel);
  }
  channel.count++;
  channel.listeners.add(callback);

  const startChannel = () => {
    if (!channel || channel.unsubscribe) return;
    try {
      channel.unsubscribe = buildQuery((rows: any[]) => {
        channel.listeners.forEach((cb) => {
          try {
            cb(rows);
          } catch (e) {
            console.warn(`[sharedRealtime] Erreur listener '${kind}':`, e);
          }
        });
      }) || null;
    } catch (e) {
      console.warn(`[sharedRealtime] Démarrage canal '${kind}' impossible:`, e);
    }
  };
  const stopChannel = () => {
    if (!channel || !channel.unsubscribe) return;
    try {
      channel.unsubscribe();
    } catch (e) {
      console.warn(`[sharedRealtime] Arrêt canal '${kind}':`, e);
    }
    channel.unsubscribe = null;
  };
  const handleVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.hidden) stopChannel();
    else startChannel();
  };

  if (!channel.visibilityHandler) {
    channel.visibilityHandler = handleVisibility;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
  }

  const isHidden = typeof document !== "undefined" && document.hidden;
  if (!isHidden) startChannel();

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    const ch = sharedChannels.get(kind);
    if (!ch) return;
    ch.listeners.delete(callback);
    ch.count--;
    if (ch.count <= 0) {
      stopChannel();
      if (ch.visibilityHandler && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", ch.visibilityHandler);
      }
      sharedChannels.delete(kind);
    }
  };
  return dispose;
}

export { serverTimestamp };