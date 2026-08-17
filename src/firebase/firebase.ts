import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  memoryLocalCache,
  setLogLevel
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// 1. Expose Firestore errors in console instead of hiding them
setLogLevel('error');

const firebaseConfig = {
  apiKey: "AIzaSyBrfPqaxbmIlC0vdfAQZxvT6XLZ-RnQd10",
  authDomain: "campusbf.firebaseapp.com",
  projectId: "campusbf",
  storageBucket: "campusbf.firebasestorage.app",
  messagingSenderId: "582288092675",
  appId: "1:582288092675:web:156b3c720951296fc12836"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Initialize Firebase Storage safely
let storageInstance: any = null;
try {
  storageInstance = getStorage(app);
} catch (storageErr) {
  console.warn("[Firebase] Storage service not initialized or unavailable:", storageErr);
}
export const storage = storageInstance;

// Initialize Firebase Functions safely
let functionsInstance: any = null;
try {
  functionsInstance = getFunctions(app);
} catch (fnErr) {
  console.warn("[Firebase] Functions service not initialized or unavailable:", fnErr);
}
export const functions = functionsInstance;

// Adaptive long polling: use experimentalForceLongPolling only in sandboxed preview iframe/containers where WebSockets are restricted.
// In standard browser / production environments (like Vercel), standard WebSockets provide faster real-time updates and lower latency.
const isSandboxPreview = typeof window !== "undefined" && (
  window.location.hostname.includes("run.app") || 
  window.location.hostname.includes("localhost") ||
  window.self !== window.top
);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({}),
  experimentalForceLongPolling: isSandboxPreview
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

/**
 * Notifie l'application d'une erreur critique de permission ou de connexion Firestore
 * afin qu'elle s'affiche clairement à l'écran de l'utilisateur.
 */
export function notifyFirestorePermissionError(details: { path?: string | null; operationType?: string; error?: string }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("wakat_firestore_permission_error", {
        detail: {
          path: details.path || "données",
          operationType: details.operationType || "opération",
          message: "Impossible de charger ou enregistrer vos données — problème de permissions Firestore (vérifiez votre authentification ou les règles de sécurité).",
          rawError: details.error
        }
      })
    );
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isPermissionDenied = errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("denied") || errMsg.toLowerCase().includes("missing or insufficient");

  if (isPermissionDenied) {
    notifyFirestorePermissionError({ path, operationType: String(operationType), error: errMsg });
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default app;

