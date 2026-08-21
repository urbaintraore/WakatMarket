/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  Monitor,
  CheckCircle2,
  X,
  WifiOff,
  Zap,
  ShieldCheck,
  Globe,
  Sparkles,
  ExternalLink,
  Layers
} from "lucide-react";

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onPromptTriggered?: () => void;
}

export function PWAInstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  onPromptTriggered
}: PWAInstallModalProps) {
  const [deviceType, setDeviceType] = useState<"ios" | "android" | "desktop">("android");
  const [installSuccess, setInstallSuccess] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect OS / Device
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    const isIos = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /android/i.test(userAgent);

    if (isIos) {
      setDeviceType("ios");
    } else if (isAndroid) {
      setDeviceType("android");
    } else {
      setDeviceType("desktop");
    }

    // Check if app is already running standalone
    const isAppStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      (window as any).__PWA_INSTALLED__ === true;
    setIsStandalone(isAppStandalone);
  }, []);

  const effectivePrompt = deferredPrompt || (typeof window !== "undefined" ? (window as any).__DEFERRED_PWA_PROMPT__ : null);

  const handleNativeInstall = async () => {
    const promptToUse = effectivePrompt;
    if (promptToUse && typeof promptToUse.prompt === "function") {
      try {
        await promptToUse.prompt();
        const choiceResult = await promptToUse.userChoice;
        if (choiceResult && choiceResult.outcome === "accepted") {
          setInstallSuccess(true);
          (window as any).__PWA_INSTALLED__ = true;
          (window as any).__DEFERRED_PWA_PROMPT__ = null;
          if (onPromptTriggered) onPromptTriggered();
        }
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
      }
    }
  };


  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
          id="pwa-install-modal"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-900 via-zinc-900 to-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-inner">
                <Download className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">
                  <Globe className="w-3 h-3 text-emerald-400" /> Application Web Progressive (PWA)
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  Installer WakatMarket
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer relative z-10"
              id="close-pwa-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs">
            {/* Highlights banner */}
            <div className="grid grid-cols-2 gap-2 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-[11px]">
                <WifiOff className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>100% Fonctionnel Hors-ligne</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-[11px]">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Accès instantané & Plein écran</span>
              </div>
            </div>

            {/* Direct 1-Click Install Button if supported by browser */}
            {effectivePrompt && !installSuccess && (
              <div className="p-4 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-sm">Installation automatique disponible !</p>
                  <p className="text-[11px] text-emerald-100 mt-0.5">
                    Votre navigateur supporte l'installation directe en 1 clic.
                  </p>
                </div>
                <button
                  onClick={handleNativeInstall}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white text-emerald-900 font-bold rounded-xl shadow-md hover:bg-emerald-50 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  id="pwa-direct-install-btn"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>Installer sur l'appareil</span>
                </button>
              </div>
            )}

            {installSuccess && (
              <div className="p-4 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-xs">Installation confirmée !</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    L'icône WakatMarket est maintenant sur votre écran d'accueil.
                  </p>
                </div>
              </div>
            )}

            {/* Device selection tabs */}
            <div>
              <p className="font-bold text-zinc-700 dark:text-zinc-300 text-xs mb-2">
                Instructions d'installation par appareil :
              </p>
              <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                <button
                  onClick={() => setDeviceType("android")}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    deviceType === "android"
                      ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Android</span>
                </button>
                <button
                  onClick={() => setDeviceType("ios")}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    deviceType === "ios"
                      ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>iPhone / iPad</span>
                </button>
                <button
                  onClick={() => setDeviceType("desktop")}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    deviceType === "desktop"
                      ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>PC / Mac</span>
                </button>
              </div>
            </div>

            {/* Platform Guides */}
            <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              {deviceType === "android" && (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Ouvrez le menu du navigateur
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        Appuyez sur les <strong>3 points verticaux (⋮)</strong> en haut à droite dans Chrome, Edge ou Samsung Internet.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Sélectionnez « Installer l'application »
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        Ou appuyez sur <strong>« Ajouter à l'écran d'accueil »</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Confirmez l'ajout
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        L'application se lance désormais en plein écran comme une application native, même sans réseau.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {deviceType === "ios" && (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Touchez le bouton Partager dans Safari
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px] flex items-center gap-1">
                        Touchez l'icône <Share className="w-3.5 h-3.5 text-blue-500 inline" /> (carré avec flèche vers le haut) en bas de Safari.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Faites défiler vers le bas
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px] flex items-center gap-1">
                        Sélectionnez l'option <PlusSquare className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 inline" /> <strong>« Sur l'écran d'accueil »</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Touchez « Ajouter » en haut à droite
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        L'icône WakatMarket s'installe directement sur l'écran d'accueil de votre iPhone/iPad.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {deviceType === "desktop" && (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Dans la barre d'adresse de Chrome ou Edge
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        Cliquez sur l'icône d'installation <strong>(petit écran avec flèche ⤓)</strong> située à droite de la barre d'adresse.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        Confirmez « Installer »
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        WakatMarket s'ouvrira dans sa propre fenêtre indépendante sur votre bureau.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Note & Close */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-zinc-400">
                {isStandalone ? "🟢 Application déjà installée en mode autonome" : "💡 L'application fonctionne aussi directement dans le navigateur"}
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl transition cursor-pointer text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
