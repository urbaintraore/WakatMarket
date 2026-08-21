import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

console.log("[WAKATMARKET] SUPABASE-ALIGNMENT-V1");

// Global PWA prompt capture immediately before any component lifecycle mounts
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    // Prevent standard minibar from appearing automatically
    e.preventDefault();
    console.log("[PWA] Événement 'beforeinstallprompt' capturé au démarrage global.");
    (window as any).__DEFERRED_PWA_PROMPT__ = e;
    window.dispatchEvent(new CustomEvent("pwa-prompt-ready", { detail: e }));
  });

  window.addEventListener("appinstalled", () => {
    console.log("[PWA] Événement 'appinstalled' confirmé par le système.");
    (window as any).__PWA_INSTALLED__ = true;
    (window as any).__DEFERRED_PWA_PROMPT__ = null;
    window.dispatchEvent(new CustomEvent("pwa-installed"));
  });
}

// Register Service Worker for PWA Offline Capability & Installability
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA Service Worker] Enregistré avec succès:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA Service Worker] Erreur enregistrement:", err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);


