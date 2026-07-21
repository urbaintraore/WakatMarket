/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Scan, QrCode, Sparkles, RefreshCw, X, Check, Volume2 } from "lucide-react";
import { Product } from "../types";
import { formatCFA } from "../data";

interface BarcodeScannerProps {
  onScanSuccess: (product: Product, code: string) => void;
  products: Product[];
  onClose?: () => void;
}

export default function BarcodeScanner({ onScanSuccess, products, onClose }: BarcodeScannerProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<{ product: Product; code: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sound play simulation
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // Beep frequency
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio Context beep failed", e);
    }
  };

  // Start Camera
  useEffect(() => {
    if (activeTab === "camera" && isScanning) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Webcam not available:", err);
          setErrorMsg("Caméra indisponible ou permissions refusées. Simulation en cours.");
        });
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [activeTab, isScanning]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  const handleSimulatedScan = (product: Product) => {
    playBeep();
    setIsScanning(false);
    setScanResult({ product, code: product.barcode });
    setTimeout(() => {
      onScanSuccess(product, product.barcode);
    }, 1500);
  };

  const handleManualCodeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const code = data.get("code") as string;
    const found = products.find((p) => p.barcode === code || p.qrCode === code);

    if (found) {
      playBeep();
      setIsScanning(false);
      setScanResult({ product: found, code });
      setTimeout(() => {
        onScanSuccess(found, code);
      }, 1500);
    } else {
      setErrorMsg("Code-barres ou QR Code non répertorié sur la plateforme.");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden max-w-md w-full mx-auto" id="barcode-scanner-widget">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-850 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-emerald-600 animate-pulse" />
          <h3 className="font-semibold text-zinc-950 dark:text-white text-base">
            Lecteur Intelligent (B2B/B2C)
          </h3>
        </div>
        {onClose && (
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            id="close-scanner-btn"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-100 dark:border-zinc-800/80">
        <button
          onClick={() => {
            setActiveTab("camera");
            setErrorMsg(null);
            setIsScanning(true);
            setScanResult(null);
          }}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "camera"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-900"
          }`}
          id="scanner-tab-camera"
        >
          <Scan className="w-3.5 h-3.5" /> Caméra / Viseur
        </button>
        <button
          onClick={() => {
            setActiveTab("manual");
            setErrorMsg(null);
            setIsScanning(true);
            setScanResult(null);
          }}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "manual"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-900"
          }`}
          id="scanner-tab-manual"
        >
          <QrCode className="w-3.5 h-3.5" /> Code Manuel / Simulation
        </button>
      </div>

      {/* Body Content */}
      <div className="p-6">
        {activeTab === "camera" && (
          <div className="space-y-4">
            {/* Viewfinder Frame */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border border-zinc-200 dark:border-zinc-850 shadow-inner">
              {isScanning && !scanResult && (
                <>
                  {/* Laser Red Line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-[bounce_2.5s_infinite]" />

                  {/* Corners */}
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-500" />
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-500" />
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-500" />
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-500" />

                  {/* Stream element or simulated grid */}
                  {cameraStream ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-10 h-10 bg-emerald-900/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-zinc-400 text-[11px] max-w-xs mx-auto">
                        Simulateur actif. Sélectionnez un produit ci-dessous pour simuler un scan de code-barres / QR Code instantané.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Success Screen */}
              {scanResult && (
                <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center text-white p-4 animate-[fadeIn_0.3s_ease]">
                  <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mb-3 shadow-lg">
                    <Check className="w-6 h-6 text-white stroke-[3px]" />
                  </div>
                  <h4 className="font-bold text-sm">Produit Identifié !</h4>
                  <p className="text-[11px] text-emerald-200 text-center max-w-xs mt-1">
                    {scanResult.product.name}
                  </p>
                  <p className="font-mono text-[10px] text-emerald-400 mt-2 bg-emerald-900/60 px-2 py-0.5 rounded">
                    Code: {scanResult.code}
                  </p>
                </div>
              )}
            </div>

            {/* Simulated Fast-Scan Selection Grid */}
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> Simuler un scan de produit (Écologie ERP)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSimulatedScan(p)}
                    disabled={!isScanning}
                    className="flex items-center gap-2 p-2 border border-zinc-150 dark:border-zinc-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:border-emerald-200 text-left transition"
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {p.name}
                      </p>
                      <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                        {p.barcode}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "manual" && (
          <div className="space-y-4">
            <form onSubmit={handleManualCodeSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Saisir le Code-barres ou QR Code (ex: {products[0]?.barcode})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="code"
                    required
                    placeholder="Entrer le code de 13 chiffres..."
                    className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    Valider
                  </button>
                </div>
              </div>
            </form>

            <div className="bg-zinc-50 dark:bg-zinc-850 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                Codes enregistrés à tester :
              </p>
              <div className="divide-y divide-zinc-150 dark:divide-zinc-800">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="py-1.5 flex justify-between items-center gap-2"
                  >
                    <span>{p.name}</span>
                    <button
                      onClick={() => {
                        const form = document.querySelector("form") as HTMLFormElement;
                        if (form) {
                          const input = form.querySelector("input[name='code']") as HTMLInputElement;
                          if (input) {
                            input.value = p.barcode;
                          }
                        }
                      }}
                      className="font-mono text-emerald-600 hover:underline hover:text-emerald-500"
                    >
                      {p.barcode}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-[11px] text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="hover:text-red-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
