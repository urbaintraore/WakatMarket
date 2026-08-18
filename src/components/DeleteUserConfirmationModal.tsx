import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, AlertTriangle, Trash2, RefreshCw, CheckCircle } from "lucide-react";
import { userService } from "../services/userService";
import { supabase } from "../supabase";
import { UserProfile } from "../types";

interface DeleteUserConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess: (userId: string) => void;
  isRealUser: boolean;
}

export default function DeleteUserConfirmationModal({
  isOpen,
  onClose,
  user,
  onSuccess,
  isRealUser
}: DeleteUserConfirmationModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen || !user) return null;

  const targetEmail = user.email || "";
  const targetName = user.companyName || user.name || "Utilisateur";

  const handleNextStep = () => {
    setStep(2);
    setError(null);
  };

  const handlePrevStep = () => {
    setStep(1);
    setError(null);
  };

  const handleClose = () => {
    setStep(1);
    setConfirmText("");
    setIsDeleting(false);
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleDelete = async () => {
    // Exact verification
    const isMatch = 
      confirmText.trim().toLowerCase() === "supprimer" || 
      (targetEmail && confirmText.trim().toLowerCase() === targetEmail.trim().toLowerCase());

    if (!isMatch) {
      setError("La saisie ne correspond ni à l'adresse e-mail ni au mot 'SUPPRIMER'.");
      return;
    }

    setIsDeleting(true);
    setError(null);

    if (!isRealUser) {
      // Simulate API delay for local/demo mode
      setTimeout(() => {
        setIsDeleting(false);
        setSuccess(true);
        onSuccess(user.id);
      }, 1000);
      return;
    }

    try {
      await userService.deleteUser(user.id);
      
      // Also clean up from Supabase table if directly available
      if (supabase) {
        await supabase.from("profiles").delete().eq("id", user.id);
        await supabase.from("users").delete().eq("id", user.id);
      }

      setSuccess(true);
      onSuccess(user.id);
    } catch (err: any) {
      console.error("Erreur lors de la suppression de l'utilisateur:", err);
      const friendlyMessage = err.message || "Une erreur inattendue est survenue lors de la suppression.";
      setError(friendlyMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/20">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-lg">Suppression sécurisée du compte</h3>
            </div>
            {!isDeleting && !success && (
              <button
                onClick={handleClose}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6 flex-1">
            {success ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 animate-bounce" />
                </div>
                <h4 className="font-bold text-zinc-900 dark:text-white text-lg mb-2">Compte supprimé avec succès</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                  L'utilisateur <strong>{targetName}</strong> ({targetEmail}) a été définitivement supprimé de l'authentification et de la base de données.
                </p>
              </div>
            ) : (
              <>
                {/* Error Banner */}
                {error && (
                  <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed">
                    <span className="font-bold">Erreur:</span>
                    <span>{error}</span>
                  </div>
                )}

                {step === 1 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Compte à supprimer</span>
                      <div className="mt-1 font-bold text-zinc-900 dark:text-white text-base">{targetName}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{targetEmail || "Aucun email configuré"}</div>
                      <div className="mt-2.5 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 uppercase">
                        Rôle: {user.role}
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/60 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-sm text-amber-800 dark:text-amber-400">Action irréversible</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-500/90 mt-1 leading-relaxed">
                          La suppression détruira définitivement l'accès de l'utilisateur à l'application et supprimera sa fiche d'identité Firestore. Ses commandes et données de transactions antérieures ne seront plus associées à un utilisateur actif.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/40 rounded-xl">
                      <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed font-semibold">
                        Étape 2/2 : Pour confirmer et éviter toute erreur, veuillez saisir le mot <strong className="text-rose-600 dark:text-rose-400">SUPPRIMER</strong> ou l'adresse email de l'utilisateur concerné ci-dessous :
                      </p>
                      <div className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-200 select-all p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center break-all">
                        {targetEmail || "(Pas d'email configuré, saisissez 'SUPPRIMER')"}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Saisie de confirmation (saisissez "SUPPRIMER" ou l'email)
                      </label>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Saisissez 'SUPPRIMER' ou l'adresse e-mail"
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500 font-mono"
                        disabled={isDeleting}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/20 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
            {success ? (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg transition cursor-pointer"
              >
                Fermer
              </button>
            ) : (
              <>
                {step === 1 ? (
                  <>
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-sm rounded-lg transition cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleNextStep}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-lg transition cursor-pointer flex items-center gap-1.5"
                    >
                      Étape suivante
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handlePrevStep}
                      disabled={isDeleting}
                      className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-sm rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      Retour
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting || (
                        confirmText.trim().toLowerCase() !== "supprimer" &&
                        (!targetEmail || confirmText.trim().toLowerCase() !== targetEmail.trim().toLowerCase())
                      )}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Supprimer définitivement
                        </>
                      )}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
