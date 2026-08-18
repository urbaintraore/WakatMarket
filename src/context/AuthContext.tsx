import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { authService, formatSupabaseAuthError } from "../services/authService";
import { userService, SupabaseUser } from "../services/userService";
import { UserRole, normalizeUserRole, isBonkoungou } from "../types";

export interface AuthUserObject {
  uid: string;
  id: string;
  email: string;
  displayName?: string;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: AuthUserObject | null; // For backward compatibility with existing views
  dbUser: SupabaseUser | null;
  loading: boolean;
  error: string | null;
  confirmationResult: any;
  recaptchaVerifier: any;
  
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    password: string,
    nom: string,
    prénom: string,
    téléphone: string,
    rôle: string,
    pays?: string,
    ville?: string,
    quartier?: string,
    latitude?: number,
    longitude?: number
  ) => Promise<void>;
  requestPhoneOTP: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
  verifyPhoneOTP: (
    code: string,
    nom?: string,
    prénom?: string,
    email?: string,
    rôle?: string
  ) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (fields: Partial<SupabaseUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize Supabase user and profile on auth state changes
  useEffect(() => {
    let isMounted = true;

    async function loadUserProfile(user: User | null) {
      if (!user) {
        if (isMounted) {
          setSupabaseUser(null);
          setDbUser(null);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setSupabaseUser(user);
        setLoading(true);
      }

      try {
        let profile = await userService.getUser(user.id);
        const email = (user.email || "").toLowerCase().trim();

        if (!profile) {
          // Création automatique du profil dans PostgreSQL si manquant
          const metaRole = user.user_metadata?.role || user.user_metadata?.rôle || "CLIENT";
          const metaName = user.user_metadata?.name || user.user_metadata?.nom || email.split("@")[0];
          let roleToSet = metaRole;
          if (email === "urbain.traore@yahoo.fr" || email === "urbain.traoreurb@gmail.com" || email.includes("admin")) {
            roleToSet = UserRole.ADMIN;
          } else if (isBonkoungou(email)) {
            roleToSet = UserRole.SEMI_WHOLESALER;
          }

          const normRole = normalizeUserRole(roleToSet);
          profile = {
            uid: user.id,
            id: user.id,
            nom: metaName,
            prénom: user.user_metadata?.prénom || "",
            email: email,
            téléphone: user.user_metadata?.phone || user.user_metadata?.téléphone || "",
            rôle: normRole,
            role: normRole,
            dateCréation: new Date().toISOString(),
            statut: "ACTIF"
          };
          await userService.createUser(profile);
        }

        if (isMounted) {
          setDbUser(profile);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du profil Supabase:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    // 1. Initial check
    authService.getCurrentUser().then(loadUserProfile);

    // 2. Subscribe to auth changes
    const { data: authListener } = authService.onAuthStateChange(async (_event, session) => {
      loadUserProfile(session?.user || null);
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await authService.signInWithEmail(email, password);
      if (user) {
        let profile = await userService.getUser(user.id);
        if (!profile) {
          const normEmail = email.toLowerCase().trim();
          let determinedRole = "CLIENT";
          if (normEmail.includes("detaillant")) determinedRole = "RETAILER";
          else if (normEmail.includes("demi-grossiste") || normEmail.includes("demigros") || normEmail.includes("semi")) determinedRole = "SEMI_WHOLESALER";
          else if (normEmail.includes("grossiste") || normEmail.includes("wholesaler")) determinedRole = "WHOLESALER";
          else if (normEmail.includes("fabricant") || normEmail.includes("manufacturer")) determinedRole = "MANUFACTURER";
          else if (normEmail.includes("admin") || normEmail === "urbain.traore@yahoo.fr" || normEmail === "urbain.traoreurb@gmail.com") determinedRole = "ADMIN";

          const normRole = normalizeUserRole(determinedRole);
          profile = {
            uid: user.id,
            id: user.id,
            nom: normEmail.split("@")[0],
            prénom: "",
            email: normEmail,
            téléphone: "",
            rôle: normRole,
            role: normRole,
            dateCréation: new Date().toISOString(),
            statut: "ACTIF"
          };
          await userService.createUser(profile);
        }
        setDbUser(profile);
        setSupabaseUser(user);
      }
    } catch (err: any) {
      const msg = formatSupabaseAuthError(err?.message || "Identifiants invalides ou erreur de connexion.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    nom: string,
    prénom: string,
    téléphone: string,
    rôle: string,
    pays?: string,
    ville?: string,
    quartier?: string,
    latitude?: number,
    longitude?: number
  ) => {
    setLoading(true);
    setError(null);

    const normEmail = email.toLowerCase().trim();
    const finalRole = (normEmail === "urbain.traore@yahoo.fr" || normEmail === "urbain.traoreurb@gmail.com" || normEmail.includes("admin"))
      ? UserRole.ADMIN
      : (isBonkoungou(normEmail) || normEmail.includes("bonkoungou") || normEmail.includes("bonkougou"))
        ? UserRole.SEMI_WHOLESALER
        : normalizeUserRole(rôle);

    try {
      const { user } = await authService.signUpWithEmail(email, password, {
        nom: nom.trim(),
        prénom: prénom.trim(),
        name: `${prénom.trim()} ${nom.trim()}`.trim(),
        role: finalRole,
        phone: téléphone.trim()
      });

      if (user) {
        const newUser: SupabaseUser = {
          uid: user.id,
          id: user.id,
          nom: nom.trim(),
          prénom: prénom.trim(),
          email: normEmail,
          téléphone: téléphone.trim(),
          phone: téléphone.trim(),
          rôle: finalRole,
          role: finalRole,
          dateCréation: new Date().toISOString(),
          statut: "ACTIF",
          pays: pays || "Burkina Faso",
          ville: ville || "Ouagadougou",
          quartier,
          latitude,
          longitude,
          companyName: `${nom.trim()} Entreprise`
        };

        await userService.createUser(newUser);
        setDbUser(newUser);
        setSupabaseUser(user);
      }
    } catch (err: any) {
      const msg = formatSupabaseAuthError(err?.message || "Erreur lors de l'inscription.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const requestPhoneOTP = async (_phoneNumber: string, _recaptchaContainerId: string) => {
    // Supabase Phone OTP endpoint
    setError("La connexion par SMS n'est pas activée sur ce projet.");
  };

  const verifyPhoneOTP = async () => {
    setError("La connexion par SMS n'est pas activée sur ce projet.");
  };

  const sendPasswordReset = async (email: string) => {
    setError(null);
    try {
      await authService.sendPasswordReset(email);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la réinitialisation.");
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.logout();
      setDbUser(null);
      setSupabaseUser(null);
    } catch (err: any) {
      setError(err.message || "Erreur de déconnexion.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (fields: Partial<SupabaseUser>) => {
    const targetUid = supabaseUser?.id || dbUser?.uid;
    if (!targetUid) throw new Error("Aucun utilisateur connecté.");
    setError(null);
    try {
      await userService.updateUser(targetUid, fields);
      setDbUser((prev) => (prev ? { ...prev, ...fields } : ({ uid: targetUid, ...fields } as SupabaseUser)));
    } catch (err: any) {
      setError(err.message || "Erreur de mise à jour du profil.");
      throw err;
    }
  };

  const authUserObject: AuthUserObject | null = supabaseUser
    ? {
        uid: supabaseUser.id,
        id: supabaseUser.id,
        email: supabaseUser.email || dbUser?.email || "",
        displayName: dbUser ? `${dbUser.prénom || ""} ${dbUser.nom || ""}`.trim() : supabaseUser.email,
        emailVerified: true
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: supabaseUser,
        supabaseUser: authUserObject,
        dbUser,
        loading,
        error,
        confirmationResult: null,
        recaptchaVerifier: null,
        loginWithEmail,
        registerWithEmail,
        requestPhoneOTP,
        verifyPhoneOTP,
        sendPasswordReset,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
