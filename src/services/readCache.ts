import { firestoreGetAll, firestoreGetWhere } from "../firebase";

/**
 * Cache mémoire Firestore (lectures) avec TTL + « single-flight ».
 *
 * Objectif : les flux temps réel ré-émettent régulièrement ; au lieu d'une
 * requête Firestore à chaque événement (comme avant), les lectures répétées
 * dans un court intervalle sont servies depuis ce cache. Les appels
 * concurrents partagent la même promesse (aucune requête dupliquée).
 */

const TTL_DEFAULT = 30_000;

interface CacheEntry {
  expires: number;
  promise: Promise<any[]>;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<any[]>>();

function keyOf(collection: string, field?: string, op?: string, value?: any): string {
  return field ? `${collection}|${field}|${op}|${JSON.stringify(value ?? "")}` : `${collection}|all`;
}

function memo(key: string, fetcher: () => Promise<any[]>, ttlMs: number): Promise<any[]> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.promise;

  const running = inFlight.get(key);
  if (running) return running;

  const promise = fetcher().catch((err) => {
    cache.delete(key);
    inFlight.delete(key);
    throw err;
  });
  promise.finally(() => {
    inFlight.delete(key);
  }).catch(() => {});
  inFlight.set(key, promise);
  cache.set(key, { expires: now + ttlMs, promise });
  return promise;
}

export function cachedFirestoreWhere(
  collection: string,
  field: string,
  op: any,
  value: any,
  ttlMs: number = TTL_DEFAULT
): Promise<any[]> {
  return memo(keyOf(collection, field, String(op), value), () => firestoreGetWhere(collection, field, op, value), ttlMs);
}

export function cachedFirestoreGetAll(collection: string, ttlMs: number = TTL_DEFAULT): Promise<any[]> {
  return memo(keyOf(collection), () => firestoreGetAll(collection), ttlMs);
}