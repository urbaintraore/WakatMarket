import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  Copy, 
  Check, 
  FileText, 
  Clock, 
  Eye, 
  AlertTriangle,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { Order, NumeroPaiement } from "../types";
import { paymentProofService } from "../services/paymentProofService";

interface PreuvePaiementUploadModalProps {
  order: Order | any;
  sellerNumbers?: NumeroPaiement[];
  vendeurNumeros?: NumeroPaiement[];
  sellerName?: string;
  vendeurNom?: string;
  currentUserId?: string;
  currentUserName?: string;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: (url: string | any) => void;
  addNotification?: (msg: string) => void;
}

export function PreuvePaiementUploadModal({
  order,
  sellerNumbers,
  vendeurNumeros,
  sellerName,
  vendeurNom,
  currentUserId = "",
  currentUserName = "Acheteur",
  isOpen,
  onClose,
  onSuccess,
  addNotification
}: PreuvePaiementUploadModalProps) {
  const resolvedSellerNumbers = sellerNumbers || vendeurNumeros || [];
  const resolvedSellerName = sellerName || vendeurNom || "Le commerçant";
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(order.preuvePaiementUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalAmount = Number(order.totalAmount || order.total || 0);
  const statutPaiement = order.statutPaiement || (order.paymentStatus === "PAID" ? "valide" : "en_attente_preuve");

  // Fallback de numéros de paiement si non fournis dans la commande
  const paymentNumbers: NumeroPaiement[] = 
    (order.numerosPaiementVendeur && order.numerosPaiementVendeur.length > 0)
      ? order.numerosPaiementVendeur
      : (resolvedSellerNumbers && resolvedSellerNumbers.length > 0)
        ? resolvedSellerNumbers
        : [
            {
              operateur: "Orange Money",
              numero: "+226 70 00 00 00",
              nomTitulaire: resolvedSellerName
            }
          ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Veuillez sélectionner une image valide (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("La taille du fichier ne doit pas dépasser 10 Mo.");
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !previewUrl) {
      setErrorMessage("Veuillez choisir une capture d'écran de votre virement Mobile Money.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      if (selectedFile) {
        const downloadUrl = await paymentProofService.uploadPreuvePaiement({
          venteId: order.id,
          file: selectedFile,
          vendeurId: order.receiverId || order.vendeurId,
          acheteurId: currentUserId,
          totalAmount,
          vendeurNom: sellerName,
          acheteurNom: currentUserName
        });

        setSuccessMessage("Capture d'écran transmise avec succès au vendeur pour validation.");
        if (addNotification) {
          addNotification("Preuve de paiement soumise avec succès au vendeur.");
        }
        onSuccess(downloadUrl);
      } else {
        setSuccessMessage("Votre preuve est déjà enregistrée.");
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Error uploading proof:", err);
      setErrorMessage(err.message || "Erreur lors de l'envoi de la preuve de paiement.");
    } finally {
      setIsUploading(false);
    }
  };

  const getBadgeForStatus = (status: string) => {
    switch (status) {
      case "valide":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          label: "Paiement Validé & Facture émise"
        };
      case "preuve_soumise":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
          icon: <Clock className="w-4 h-4 text-amber-600" />,
          label: "Preuve soumise, en cours de vérification par le commerçant"
        };
      case "rejete":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
          icon: <AlertCircle className="w-4 h-4 text-rose-600" />,
          label: "Preuve rejetée par le commerçant"
        };
      default:
        return {
          bg: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
          icon: <Smartphone className="w-4 h-4 text-zinc-600" />,
          label: "En attente de paiement Mobile Money"
        };
    }
  };

  const badge = getBadgeForStatus(statutPaiement);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-6 text-left"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                Paiement Mobile Money Direct
              </h3>
              <p className="text-xs text-zinc-500">
                Commande #{order.id?.slice(0, 8)} • Montant : <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalAmount.toLocaleString("fr-FR")} FCFA</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Status banner */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${badge.bg}`}>
            <div className="mt-0.5">{badge.icon}</div>
            <div className="text-xs leading-snug">
              <span className="font-bold block">{badge.label}</span>
              {statutPaiement === "rejete" && order.commentaireRejet && (
                <span className="mt-1 block font-semibold text-rose-800 dark:text-rose-200">
                  Motif du refus : "{order.commentaireRejet}"
                </span>
              )}
            </div>
          </div>

          {/* Feedback message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Step 1 : Merchant mobile money coordinates */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                1. Effectuez votre virement vers un des numéros du commerçant
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {paymentNumbers.map((num, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 rounded-xl flex items-center justify-between hover:border-amber-400 dark:hover:border-amber-600 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center font-bold text-xs text-amber-700 dark:text-amber-400">
                      {num.operateur?.includes("Orange") ? "OM" : num.operateur?.includes("Moov") ? "MM" : "TEL"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {num.operateur}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                          {num.numero}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 block">
                        Titulaire : <strong className="text-zinc-700 dark:text-zinc-300">{num.nomTitulaire}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(num.numero, idx)}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-650 rounded-lg text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                        Copier
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2 : Upload payment proof screenshot */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                2. Déposez la capture d'écran (reçu SMS ou application)
              </label>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-5 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                    : previewUrl
                      ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : "border-zinc-200 dark:border-zinc-750 hover:border-zinc-300 dark:hover:border-zinc-650 bg-zinc-50/50 dark:bg-zinc-850/40"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="space-y-3">
                    <div className="relative inline-block max-h-56 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-md">
                      <img
                        src={previewUrl}
                        alt="Preuve de paiement"
                        className="max-h-52 object-contain mx-auto"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                        <Upload className="w-4 h-4" /> Cliquer pour changer l'image
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {selectedFile ? selectedFile.name : "Capture d'écran enregistrée"} • {(selectedFile ? (selectedFile.size / 1024).toFixed(1) + " Ko" : "Preuve prête")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Glissez votre capture d'écran ici, ou cliquez pour parcourir
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Formats acceptés : JPG, PNG, WebP (max 10 Mo)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-sm transition cursor-pointer"
              >
                Fermer
              </button>

              <button
                type="submit"
                disabled={isUploading || (!selectedFile && !previewUrl)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {statutPaiement === "rejete" ? "Renvoyer la nouvelle preuve" : "Envoyer la preuve de paiement"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
