import { authService } from "./authService";
import { isFirebaseConfigured } from "../firebase";

/**
 * Client API WakatMarket (backend Render).
 *
 * Les appels sont "best effort" : sans VITE_BACKEND_URL configuré, sans session
 * Firebase ou hors ligne, post() retourne null sans erreur. Les erreurs HTTP
 * sont levées pour être journalisées par l'appelant (syncService), sans bloquer
 * la synchronisation locale.
 */
const API_BASE = (import.meta.env?.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") || "";

export function isBackendConfigured(): boolean {
  return Boolean(API_BASE && (import.meta.env?.VITE_BACKEND_URL as string | undefined));
}

/**
 * POST authentifié vers l'API backend (Bearer JWT Firebase).
 */
async function post(path: string, body?: any): Promise<any> {
  if (!API_BASE || !isFirebaseConfigured()) return null;
  const token = await authService.getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body !== undefined ? JSON.stringify(body) : "{}"
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `API ${res.status} sur ${path}`);
    (err as any).status = res.status;
    (err as any).details = data;
    throw err;
  }
  return data;
}

const apiService = { post, isBackendConfigured };
export default apiService;