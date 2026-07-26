import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  memoryLocalCache,
  setLogLevel
} from "firebase/firestore";

// Silence Firestore connection warnings which are common in sandboxed preview environments
setLogLevel('silent');

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

// Use Long Polling to bypass potential WebSocket restrictions in the preview environment
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({}),
  experimentalForceLongPolling: true
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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

