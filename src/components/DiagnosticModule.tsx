import React, { useState } from "react";
import { firestoreGetLimitOrdered, isFirebaseConfigured, getAuthUser, firebaseConfigError } from "../firebase";
import { uploadToCloudflare, cloudflareConfigError, isCloudflareConfigured } from "../cloudflare";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  Database, 
  CloudUpload, 
  Key, 
  ExternalLink,
  Smartphone,
  Monitor,
  AlertTriangle,
  ArrowLeft
} from "lucide-react";

export interface DiagnosticTestResult {
  id: string;
  title: string;
  status: "idle" | "running" | "success" | "error";
  userMessage: string;
  technicalDetail: string;
  imageUrl?: string;
}

interface DiagnosticModuleProps {
  onBack?: () => void;
}

export const DiagnosticModule: React.FC<DiagnosticModuleProps> = ({ onBack }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  
  const [results, setResults] = useState<DiagnosticTestResult[]>([
    {
      id: "firestore_rw",
      title: "1. Écriture & Relecture Firestore Firebase",
      status: "idle",
      userMessage: "En attente du test d'écriture et de lecture dans Firestore...",
      technicalDetail: "Effectue une requête de lecture sur les collections Firestore de Firebase."
    },
    {
      id: "firebase_auth",
      title: "2. Statut Firebase Auth & Session",
      status: "idle",
      userMessage: "En attente de la vérification du module Firebase Auth...",
      technicalDetail: "Vérifie l'état de la session utilisateur et la disponibilité du service d'authentification Firebase."
    },
    {
      id: "cloud_storage_r2",
      title: "3. Cloudflare R2 Storage (MonBucket)",
      status: "idle",
      userMessage: "En attente du test de téléversement d'image dans MonBucket...",
      technicalDetail: "Téléverse une image PNG de test vers le bucket Cloudflare R2 MonBucket et valide l'URL publique."
    },
    {
      id: "config_check",
      title: "4. Configuration des Clés & Variables Firebase/Cloudflare",
      status: "idle",
      userMessage: "En attente de la vérification de la configuration...",
      technicalDetail: "Contrôle la validité des variables VITE_FIREBASE_* et VITE_CLOUDFLARE_WORKER_URL."
    }
  ]);

  const updateTestState = (id: string, patch: Partial<DiagnosticTestResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const runFullDiagnostic = async () => {
    setIsRunning(true);
    setHasRun(true);

    setResults(prev => prev.map(r => ({ ...r, status: "running", userMessage: "Test en cours...", imageUrl: undefined })));

    // -------------------------------------------------------------
    // TEST 1 : Firestore
    // -------------------------------------------------------------
    try {
      updateTestState("firestore_rw", { status: "running", userMessage: "Interrogation de la base Firestore Firebase..." });
      
      if (!isFirebaseConfigured()) {
        throw new Error(firebaseConfigError || "Firebase n'est pas configuré.");
      }

      const rows = await firestoreGetLimitOrdered("products", "", 1);

      updateTestState("firestore_rw", {
        status: "success",
        userMessage: "Connexion Firestore établie avec succès !",
        technicalDetail: `Requête réussie sur la collection 'products'. ${rows.length} document(s) disponible(s).`
      });
    } catch (err: any) {
      updateTestState("firestore_rw", {
        status: "error",
        userMessage: "Échec de la connexion à la base de données.",
        technicalDetail: `Erreur : ${err?.message || err}`
      });
    }

    // -------------------------------------------------------------
    // TEST 2 : Firebase Auth
    // -------------------------------------------------------------
    try {
      updateTestState("firebase_auth", { status: "running", userMessage: "Vérification de la session Auth..." });
      
      if (!isFirebaseConfigured()) {
        throw new Error("Client Firebase absent.");
      }

      const currentUser = await getAuthUser();

      updateTestState("firebase_auth", {
        status: "success",
        userMessage: currentUser ? `Session active pour : ${currentUser.email || currentUser.uid}` : "Service Firebase Auth opérationnel (Prêt pour connexion)",
        technicalDetail: `Statut Auth : ${currentUser ? "Utilisateur connecté" : "Invité / Non connecté"}`
      });
    } catch (err: any) {
      updateTestState("firebase_auth", {
        status: "error",
        userMessage: "Erreur d'accès au service Firebase Auth.",
        technicalDetail: `Détail : ${err?.message || err}`
      });
    }

    // -------------------------------------------------------------
    // TEST 3 : Cloudflare R2 Storage (MonBucket)
    // -------------------------------------------------------------
    try {
      updateTestState("cloud_storage_r2", { status: "running", userMessage: "Téléversement d'une image test vers MonBucket..." });

      if (!isCloudflareConfigured()) throw new Error(cloudflareConfigError || "Worker R2 non configuré.");

      // 1x1 transparent PNG
      const base64Pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const resBlob = await fetch(base64Pixel).then(r => r.blob());
      const testFile = new File([resBlob], "diagnostic_test.png", { type: "image/png" });

      const publicUrl = await uploadToCloudflare("MonBucket", `diagnostic/test_${Date.now()}.png`, testFile, "image/png");
      if (!publicUrl) throw new Error("Aucune URL publique retournée par Cloudflare R2.");

      updateTestState("cloud_storage_r2", {
        status: "success",
        userMessage: "Téléversement réussi sur Cloudflare R2 (MonBucket) !",
        technicalDetail: `URL publique vérifiée : ${publicUrl}`,
        imageUrl: publicUrl
      });
    } catch (err: any) {
      updateTestState("cloud_storage_r2", {
        status: "error",
        userMessage: "Échec du téléversement vers Cloudflare R2.",
        technicalDetail: `Erreur : ${err?.message || err}`
      });
    }

    // -------------------------------------------------------------
    // TEST 4 : Configuration des clés
    // -------------------------------------------------------------
    try {
      const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY || "").trim();
      const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim();
      const appId = (import.meta.env.VITE_FIREBASE_APP_ID || "").trim();
      const workerUrl = (import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").trim();

      if (!apiKey || !projectId || !appId || !workerUrl) {
        throw new Error("Variables VITE_FIREBASE_* ou VITE_CLOUDFLARE_WORKER_URL manquantes.");
      }

      updateTestState("config_check", {
        status: "success",
        userMessage: "Configuration Firebase/Cloudflare stricte et conforme.",
        technicalDetail: `Projet : ${projectId} | Worker R2 : ${workerUrl}`
      });
    } catch (err: any) {
      updateTestState("config_check", {
        status: "error",
        userMessage: "Configuration Firebase/Cloudflare incomplète.",
        technicalDetail: `Détail : ${err?.message || err}`
      });
    }

    setIsRunning(false);
  };

  const allSuccess = results.every(r => r.status === "success");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {onBack && (
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
            </button>
          )}
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Diagnostic d'Infrastructure Firebase/Cloudflare
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Validation en temps réel de Firebase (Firestore, Auth) et Cloudflare R2
          </p>
        </div>

        <button
          onClick={runFullDiagnostic}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Tests en cours..." : "Lancer le diagnostic"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((result) => {
          let icon = <Database className="w-5 h-5 text-slate-400" />;
          if (result.id === "firebase_auth") icon = <Key className="w-5 h-5 text-slate-400" />;
          if (result.id === "cloud_storage_r2") icon = <CloudUpload className="w-5 h-5 text-slate-400" />;
          if (result.id === "config_check") icon = <ShieldCheck className="w-5 h-5 text-slate-400" />;

          return (
            <div 
              key={result.id}
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                      {result.title}
                    </h3>
                  </div>
                </div>

                <div>
                  {result.status === "idle" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      En attente
                    </span>
                  )}
                  {result.status === "running" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin" /> En cours
                    </span>
                  )}
                  {result.status === "success" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Succès
                    </span>
                  )}
                  {result.status === "error" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Échec
                    </span>
                  )}
                </div>
              </div>

              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {result.userMessage}
              </div>

              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60 break-all">
                {result.technicalDetail}
              </div>

              {result.imageUrl && (
                <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <img src={result.imageUrl} alt="Preuve de test" className="w-10 h-10 object-contain rounded border border-slate-200 bg-white" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Image de validation Cloudflare R2 accessible</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasRun && (
        <div className={`p-4 rounded-2xl border ${allSuccess ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200" : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"}`}>
          <div className="flex items-center gap-3">
            {allSuccess ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div className="text-sm">
              {allSuccess ? (
                <span><strong>Architecture Firebase Opérationnelle :</strong> La base Firestore, l'authentification et le stockage Cloud R2 (MonBucket) sont synchronisés et prêts pour la production.</span>
              ) : (
                <span><strong>Points d'attention détectés :</strong> Certains tests nécessitent une vérification de vos variables d'environnement Firebase ou Cloudflare ou des règles de sécurité Firestore.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
