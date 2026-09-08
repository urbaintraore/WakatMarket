import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LogIn, UserPlus, Smartphone, Lock, Mail, Lock as LockIcon,
  PhoneCall, Eye, EyeOff, MapPin, RefreshCw, AlertCircle,
  CheckCircle2, Shield
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { UserRole } from "../types";

export interface AuthScreenProps {
  onAuthenticated: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.WHOLESALER]: "Grossiste",
  [UserRole.SEMI_WHOLESALER]: "Demi-Grossiste",
  [UserRole.RETAILER]: "Détaillant",
  [UserRole.MANUFACTURER]: "Fabricant",
  [UserRole.DRIVER_R2C]: "Livreur (Détaillant → Client)",
  [UserRole.DRIVER_W2R]: "Livreur (Grossiste → Détaillant)",
  [UserRole.DRIVER_W2SG]: "Livreur (Grossiste → Demi-Grossiste)",
  [UserRole.DRIVER_SG2R]: "Livreur (Demi-Grossiste → Détaillant)",
  [UserRole.DRIVER_M2W]: "Livreur (Fabricant → Grossiste)",
  [UserRole.CLIENT]: "Client",
};

// Rôles proposés à l'inscription : ADMIN est attribué uniquement côté serveur
// (e-mail privilégié ou callable admin), jamais par auto-sélection.
const SIGNUP_ROLES = (Object.entries(ROLE_LABELS) as Array<[UserRole, string]>)
  .filter(([role]) => role !== UserRole.ADMIN);

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { loginWithEmail, registerWithEmail, sendPasswordReset } = useAuth();

  const [authMode, setAuthMode] = useState<"signin" | "signup" | "phone" | "reset">("signin");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [persist, setPersist] = useState(true);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.CLIENT);
  const [otpCode, setOtpCode] = useState("");
  const [phoneForOtp, setPhoneForOtp] = useState("");

  const [pays, setPays] = useState("Burkina Faso");
  const [ville, setVille] = useState("Ouagadougou");
  const [quartier, setQuartier] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [geoLoading, setGeoLoading] = useState(false);

  const requiresGeo = useMemo(() => 
    [UserRole.MANUFACTURER, UserRole.WHOLESALER, UserRole.SEMI_WHOLESALER, UserRole.RETAILER].includes(role),
    [role]
  );

  const clearMsg = () => setMsg(null);
  const setError = (text: string) => setMsg({ type: "error", text });
  const setSuccess = (text: string) => setMsg({ type: "success", text });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMsg();
    if (!email || !password) { setError("E-mail et mot de passe requis."); return; }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      setSuccess("Connexion réussie !");
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la connexion.");
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMsg();
    if (!prenom || !nom || !telephone) { setError("Veuillez remplir tous les champs du profil."); return; }
    if (requiresGeo && (!pays.trim() || !ville.trim() || !quartier.trim())) {
      setError("Pour un Fabricant, Grossiste, Demi-Grossiste ou Détaillant, veuillez renseigner la situation géographique de l'entreprise (Pays, Ville, Quartier).");
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail(email, password, nom, prenom, telephone, role, 
        requiresGeo ? pays : undefined, requiresGeo ? ville : undefined, 
        requiresGeo ? quartier : undefined, requiresGeo ? latitude : undefined, 
        requiresGeo ? longitude : undefined);
      setSuccess("Inscription réussie ! Votre compte est opérationnel.");
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription.");
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMsg();
    if (!email) { setError("E-mail requis."); return; }
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSuccess("E-mail de réinitialisation envoyé !");
    } catch (err: any) {
      setError(err.message || "Erreur d'envoi.");
    } finally { setLoading(false); }
  };

  const handlePhoneOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMsg();
    if (!phoneForOtp) { setError("Numéro de téléphone requis."); return; }
    setError("La connexion par SMS n'est pas activée sur ce projet. Utilisez votre e-mail et mot de passe.");
  };

  const handleGeoDetect = () => {
    setGeoLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setGeoLoading(false);
          setSuccess(`Position GPS : ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => { setGeoLoading(false); setError("Impossible de récupérer la position GPS."); }
      );
    } else { setGeoLoading(false); setError("Géolocalisation non supportée."); }
  };

  const modeConfig = {
    signin: { icon: LogIn, label: "Connexion", desc: "Accédez à votre espace WakatMarket" },
    signup: { icon: UserPlus, label: "Inscription", desc: "Créez votre compte professionnel" },
    phone: { icon: Smartphone, label: "OTP Téléphone", desc: "Connexion par code SMS" },
    reset: { icon: Lock, label: "RàP", desc: "Réinitialiser votre mot de passe" },
  };

  const tabs = Object.keys(modeConfig) as Array<keyof typeof modeConfig>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl shadow-2xl shadow-zinc-950/5 overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="font-extrabold text-xl text-zinc-950 dark:text-white tracking-tight">WakatMarket</h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Distribution & Logistique Intelligente d'Afrique</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              {modeConfig[authMode].desc}
            </p>
          </div>

          {/* Tabs */}
          <div className="px-4 pb-2">
            <div className="flex gap-1 p-1 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-xl">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setAuthMode(tab); clearMsg(); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    authMode === tab
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {modeConfig[tab].label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              {msg && (
                <motion.div
                  key={msg.type}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mb-4 p-3.5 rounded-xl flex items-start gap-2.5 text-sm font-semibold ${
                    msg.type === "error"
                      ? "bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/25 dark:text-rose-300 dark:border-rose-900/50"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/25 dark:text-emerald-300 dark:border-emerald-900/50"
                  }`}
                >
                  {msg.type === "error" ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                  <span className="leading-relaxed">{msg.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sign In */}
            {authMode === "signin" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="email"
                      required
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <LockIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={persist}
                    onChange={(e) => setPersist(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Se souvenir de moi</span>
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-emerald-400 disabled:to-teal-400 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  Se connecter
                </button>
              </form>
            )}

            {/* Sign Up */}
            {authMode === "signup" && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Prénom</label>
                    <input type="text" required placeholder="Jean" value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Nom</label>
                    <input type="text" required placeholder="Ouédraogo" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="email" required placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Téléphone</label>
                    <div className="relative">
                      <PhoneCall className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input type="tel" required placeholder="+226 70 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Rôle</label>
                    <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                      {SIGNUP_ROLES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {requiresGeo && (
                  <div className="space-y-3 p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl">
                    <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Situation géographique de l'entreprise</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Pays</label>
                        <input type="text" required placeholder="Burkina Faso" value={pays} onChange={(e) => setPays(e.target.value)} className="w-full px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Ville</label>
                        <input type="text" required placeholder="Ouagadougou" value={ville} onChange={(e) => setVille(e.target.value)} className="w-full px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">Quartier</label>
                        <input type="text" required placeholder="Ouaga 2000" value={quartier} onChange={(e) => setQuartier(e.target.value)} className="w-full px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <button type="button" onClick={handleGeoDetect} disabled={geoLoading} className="px-3 py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition">
                        {geoLoading ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> : <MapPin className="w-4 h-4 text-emerald-500" />}
                        Détecter GPS
                      </button>
                      {latitude !== undefined && longitude !== undefined && (
                        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 bg-white dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/50">
                          {latitude.toFixed(5)}, {longitude.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <LockIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="Mot de passe fort"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-emerald-400 disabled:to-teal-400 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  Créer mon compte
                </button>
              </form>
            )}

            {/* Phone OTP */}
            {authMode === "phone" && (
              <form onSubmit={handlePhoneOtpRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Numéro de téléphone</label>
                  <div className="relative">
                    <PhoneCall className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="tel" required placeholder="+226 70 00 00 00" value={phoneForOtp} onChange={(e) => setPhoneForOtp(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-mono" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />}
                  Envoyer le code OTP
                </button>
                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">Fonctionnalité en cours de développement</p>
              </form>
            )}

            {/* Reset Password */}
            {authMode === "reset" && (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input type="email" required placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                  Envoyer le lien de réinitialisation
                </button>
              </form>
            )}
          </div>
        </motion.div>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-4">
          WakatMarket — Plateforme B2B + B2C pour la distribution africaine
        </p>
      </motion.div>
    </div>
  );
}