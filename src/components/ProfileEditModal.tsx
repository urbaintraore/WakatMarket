import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserCog, X, User, Mail, Shield, MapPin, RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2, Smartphone, CreditCard } from "lucide-react";
import { UserProfile, UserRole, NumeroPaiement } from "../types";
import { FirebaseUser } from "../services/userService";

export function ProfileEditModal({
  currentUser,
  dbUser,
  updateProfile,
  onClose,
  onSuccess,
  addNotification
}: {
  currentUser: UserProfile;
  dbUser: FirebaseUser | null;
  updateProfile: (fields: Partial<FirebaseUser>) => Promise<void>;
  onClose: () => void;
  onSuccess: (updatedProfile: UserProfile) => void;
  addNotification: (msg: string) => void;
}) {
  const [editPrenom, setEditPrenom] = useState("");
  const [editNom, setEditNom] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editSector, setEditSector] = useState("");
  const [editLatitude, setEditLatitude] = useState<number | undefined>(undefined);
  const [editLongitude, setEditLongitude] = useState<number | undefined>(undefined);
  const [numerosPaiement, setNumerosPaiement] = useState<NumeroPaiement[]>([]);
  
  const [fbMsg, setFbMsg] = useState<{type: "error" | "success" | "info", text: string} | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const first = dbUser?.prénom || currentUser.name.split(" ")[0] || "";
      const last = dbUser?.nom || currentUser.name.split(" ").slice(1).join(" ") || currentUser.name || "";
      setEditPrenom(first);
      setEditNom(last);
      setEditPhone(currentUser.phone || dbUser?.téléphone || "");
      setEditCompanyName(currentUser.companyName || (dbUser?.nom ? `${dbUser.nom} Entreprise` : ""));
      setEditCountry(currentUser.country || dbUser?.pays || "Burkina Faso");
      setEditRegion(currentUser.region || dbUser?.ville || "Ouagadougou");
      setEditSector(currentUser.sector || dbUser?.quartier || "");
      setEditLatitude(currentUser.latitude || dbUser?.latitude);
      setEditLongitude(currentUser.longitude || dbUser?.longitude);

      const existingNumeros = dbUser?.numerosPaiement || currentUser.numerosPaiement || [];
      if (existingNumeros.length > 0) {
        setNumerosPaiement(existingNumeros);
      } else if (currentUser.phone) {
        setNumerosPaiement([
          {
            operateur: "Orange Money",
            numero: currentUser.phone,
            nomTitulaire: currentUser.name || "Titulaire"
          }
        ]);
      } else {
        setNumerosPaiement([]);
      }
      setFbMsg(null);
    }
  }, [currentUser, dbUser]);

  const handleAddNumero = () => {
    setNumerosPaiement([
      ...numerosPaiement,
      {
        operateur: "Orange Money",
        numero: "",
        nomTitulaire: `${editPrenom} ${editNom}`.trim() || currentUser.name
      }
    ]);
  };

  const handleRemoveNumero = (index: number) => {
    setNumerosPaiement(numerosPaiement.filter((_, idx) => idx !== index));
  };

  const handleUpdateNumero = (index: number, field: keyof NumeroPaiement, value: string) => {
    const updated = [...numerosPaiement];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setNumerosPaiement(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNom.trim()) {
      setFbMsg({ type: "error", text: "Le nom est requis." });
      return;
    }

    setProfileSaving(true);
    setFbMsg(null);
    try {
      // Filtrer les numéros vides
      const cleanedNumeros = numerosPaiement.filter(n => n.numero && n.numero.trim().length > 0);

      const updatedFields: Partial<FirebaseUser> = {
        nom: editNom,
        prénom: editPrenom,
        téléphone: editPhone,
        companyName: editCompanyName,
        pays: editCountry,
        ville: editRegion,
        quartier: editSector,
        latitude: editLatitude,
        longitude: editLongitude,
        numerosPaiement: cleanedNumeros
      };

      await updateProfile(updatedFields);

      const updatedProfile: UserProfile = {
        ...currentUser,
        name: `${editPrenom} ${editNom}`.trim() || "Utilisateur",
        phone: editPhone,
        companyName: editCompanyName || `${editNom} Entreprise`,
        country: editCountry,
        region: editRegion,
        sector: editSector,
        latitude: editLatitude,
        longitude: editLongitude,
        address: editRegion && editSector ? `${editSector}, ${editRegion}, ${editCountry}` : currentUser.address,
        numerosPaiement: cleanedNumeros
      };

      onSuccess(updatedProfile);
      addNotification("Votre profil et vos numéros de paiement ont été mis à jour avec succès.");
      setFbMsg({ type: "success", text: "Profil mis à jour avec succès !" });
      
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setFbMsg({ type: "error", text: err.message || "Erreur lors de la mise à jour du profil." });
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-850">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div className="text-left">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Modifier mon Profil</h3>
              <p className="text-[10px] text-zinc-500">Mettez à jour vos informations professionnelles</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1">
          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {fbMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`p-3 rounded-xl flex items-start gap-2 ${fbMsg.type === "error" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"}`}>
                {fbMsg.type === "error" ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                <p className="text-xs font-medium leading-relaxed">{fbMsg.text}</p>
              </motion.div>
            )}

            <div className="p-3 bg-zinc-50 dark:bg-zinc-850/40 border border-zinc-100 dark:border-zinc-800/60 rounded-xl space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{currentUser.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{currentUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-500 mb-1 text-[10px]">Email (Lecture seule)</label>
                  <div className="relative">
                    <input type="text" disabled value={currentUser.email} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-750 rounded-lg text-zinc-500 cursor-not-allowed pl-8" />
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1 text-[10px]">Rôle de l'Acteur</label>
                  <div className="relative">
                    <input type="text" disabled value={currentUser.role} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-750 rounded-lg text-zinc-500 cursor-not-allowed pl-8 uppercase font-bold text-[10px]" />
                    <Shield className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-left">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">👤 Informations Générales</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Prénom</label>
                  <input type="text" placeholder="Votre prénom..." value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                </div>
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Nom de famille <span className="text-rose-500">*</span></label>
                  <input type="text" required placeholder="Votre nom..." value={editNom} onChange={(e) => setEditNom(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-semibold" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Téléphone</label>
                  <input type="text" placeholder="ex: +226 70 00 00 00" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 mb-1 font-medium">Nom de l'Entreprise</label>
                  <input type="text" placeholder="ex: Société SBD" value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl" />
                </div>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-850/40 border border-zinc-100 dark:border-zinc-800/60 rounded-xl space-y-3 text-left">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">📍 Situation Géographique & GPS</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-[10px]">Pays</label>
                  <input type="text" placeholder="Burkina Faso" value={editCountry} onChange={(e) => setEditCountry(e.target.value)} className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg text-[11px]" />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-[10px]">Ville</label>
                  <input type="text" placeholder="Ouagadougou" value={editRegion} onChange={(e) => setEditRegion(e.target.value)} className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg text-[11px]" />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1 text-[10px]">Quartier</label>
                  <input type="text" placeholder="Quartier..." value={editSector} onChange={(e) => setEditSector(e.target.value)} className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-lg text-[11px]" />
                </div>
              </div>
              <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    setGeoLoading(true);
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setEditLatitude(pos.coords.latitude);
                          setEditLongitude(pos.coords.longitude);
                          setGeoLoading(false);
                          setFbMsg({ type: "success", text: `Position GPS actuelle détectée avec succès !` });
                        },
                        () => {
                          setGeoLoading(false);
                          setFbMsg({ type: "error", text: "Impossible de récupérer votre position GPS actuelle." });
                        }
                      );
                    } else {
                      setGeoLoading(false);
                      setFbMsg({ type: "error", text: "La géolocalisation n'est pas supportée par votre navigateur." });
                    }
                  }}
                  className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-750 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {geoLoading ? <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" /> : <MapPin className="w-3 h-3 text-emerald-500" />}
                  Détecter ma position actuelle
                </button>
                {(editLatitude !== undefined && editLongitude !== undefined) && (
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold ml-auto bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md">
                    {editLatitude.toFixed(5)}, {editLongitude.toFixed(5)}
                  </span>
                )}
              </div>
            </div>

            {/* Mobile Money Payment Numbers (Pour encaissement des paiements directs) */}
            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-[11px] text-amber-900 dark:text-amber-300 font-bold uppercase tracking-wider">
                    Numéros de Paiement Mobile Money
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddNumero}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                >
                  <Plus className="w-3 h-3" /> Ajouter un numéro
                </button>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-tight">
                Vos acheteurs verront ces numéros pour effectuer leurs transferts directs (Orange Money, Moov Money, Telecel Money) et joindre leur preuve de paiement.
              </p>

              {numerosPaiement.length === 0 ? (
                <div className="p-3 bg-white/80 dark:bg-zinc-800/60 rounded-lg border border-dashed border-amber-200 dark:border-amber-800/40 text-center">
                  <p className="text-xs text-zinc-500">Aucun numéro Mobile Money configuré.</p>
                  <button
                    type="button"
                    onClick={handleAddNumero}
                    className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 font-bold hover:underline"
                  >
                    + Cliquer pour ajouter votre premier numéro
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {numerosPaiement.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-750 flex flex-col sm:flex-row gap-2 items-center">
                      <div className="w-full sm:w-1/3">
                        <label className="block text-[9px] text-zinc-400 font-bold mb-0.5">Opérateur</label>
                        <select
                          value={item.operateur}
                          onChange={(e) => handleUpdateNumero(idx, "operateur", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded-lg font-semibold text-zinc-800 dark:text-zinc-200"
                        >
                          <option value="Orange Money">🟠 Orange Money</option>
                          <option value="Moov Money">🔵 Moov Money</option>
                          <option value="Telecel Money">🔴 Telecel Money</option>
                          <option value="Wave">🌊 Wave</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>

                      <div className="w-full sm:w-1/3">
                        <label className="block text-[9px] text-zinc-400 font-bold mb-0.5">Numéro Mobile Money</label>
                        <input
                          type="text"
                          placeholder="ex: +226 70 00 00 00"
                          value={item.numero}
                          onChange={(e) => handleUpdateNumero(idx, "numero", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-mono font-bold border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-zinc-900 dark:text-white"
                        />
                      </div>

                      <div className="w-full sm:w-1/3">
                        <label className="block text-[9px] text-zinc-400 font-bold mb-0.5">Nom du Titulaire</label>
                        <input
                          type="text"
                          placeholder="Nom officiel sur la puce"
                          value={item.nomTitulaire}
                          onChange={(e) => handleUpdateNumero(idx, "nomTitulaire", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-zinc-900 dark:text-white"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveNumero(idx)}
                        title="Supprimer ce numéro"
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition self-end sm:self-center shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-sm transition-colors cursor-pointer">
                Annuler
              </button>
              <button disabled={profileSaving} type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {profileSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
