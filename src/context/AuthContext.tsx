import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "firebase/auth";
import { authService, formatFirebaseAuthError } from "../services/authService";
import { userService, FirebaseUser } from "../services/userService";
import { UserRole, normalizeUserRole, isBonkoungou, isRootAdminEmail } from "../types";
import { isNetworkError } from "../firebase";

export interface AuthUserObject {
  uid: string;
  id: string;
  email: string;
  displayName?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  photoURL?: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: AuthUserObject | null;
  dbUser: FirebaseUser | null;
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
  updateProfile: (fields: Partial<FirebaseUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize Firebase user and profile on auth state changes
  useEffect(() => {
    let isMounted = true;

    async function loadUserProfile(user: User | null) {
      if (!user) {
        if (isMounted) {
          setFirebaseUser(null);
          setDbUser(null);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setFirebaseUser(user);
        setLoading(true);
      }

      try {
        let profile = await userService.getUser(user.uid);
        const email = (user.email || "").toLowerCase().trim();

        if (!profile) {
          // Création automatique du profil dans Firestore si manquant
          const metaName = user.displayName || email.split("@")[0];
          let roleToSet = "CLIENT";
          if (isRootAdminEmail(email)) {
            roleToSet = UserRole.ADMIN;
          } else if (isBonkoungou(email)) {
            roleToSet = UserRole.SEMI_WHOLESALER;
          }

          const normRole = normalizeUserRole(roleToSet);
          profile = {
            uid: user.uid,
            id: user.uid,
            nom: metaName,
            prénom: "",
            email: email,
            téléphone: user.phoneNumber || "",
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
        if (isNetworkError(err)) {
          console.warn("[AuthContext] Synchronisation profil en mode hors-ligne.");
        } else {
          console.error("Erreur lors de la récupération du profil Firestore:", err);
        }
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
        let profile = await userService.getUser(user.uid);
        if (!profile) {
          const normEmail = email.toLowerCase().trim();
          let determinedRole = "CLIENT";
          if (normEmail.includes("detaillant")) determinedRole = "RETAILER";
          else if (normEmail.includes("demi-grossiste") || normEmail.includes("demigros") || normEmail.includes("semi")) determinedRole = "SEMI_WHOLESALER";
          else if (normEmail.includes("grossiste") || normEmail.includes("wholesaler")) determinedRole = "WHOLESALER";
          else if (normEmail.includes("fabricant") || normEmail.includes("manufacturer")) determinedRole = "MANUFACTURER";
          else if (isRootAdminEmail(normEmail)) determinedRole = "ADMIN";

          const normRole = normalizeUserRole(determinedRole);
          profile = {
            uid: user.uid,
            id: user.uid,
            nom: normEmail.split("@")[0],
            prénom: "",
            email: normEmail,
            téléphone: user.phoneNumber || "",
            rôle: normRole,
            role: normRole,
            dateCréation: new Date().toISOString(),
            statut: "ACTIF"
          };
          await userService.createUser(profile);
        }
        setDbUser(profile);
        setFirebaseUser(user);
      }
    } catch (err: any) {
      const msg = formatFirebaseAuthError(err?.message || "Identifiants invalides ou erreur de connexion.");
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
    const finalRole = isRootAdminEmail(normEmail)
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
        const newUser: FirebaseUser = {
          uid: user.uid,
          id: user.uid,
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
        setFirebaseUser(user);
      }
    } catch (err: any) {
      const msg = formatFirebaseAuthError(err?.message || "Erreur lors de l'inscription.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const requestPhoneOTP = async (_phoneNumber: string, _recaptchaContainerId: string) => {
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
      setFirebaseUser(null);
    } catch (err: any) {
      setError(err.message || "Erreur de déconnexion.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (fields: Partial<FirebaseUser>) => {
    const targetUid = firebaseUser?.uid || dbUser?.uid;
    if (!targetUid) throw new Error("Aucun utilisateur connecté.");

    // Sécurité: Détection et filtrage des tentatives de modification non autorisées de champs sensibles
    const sensitiveKeys = ["role", "rôle", "id", "uid", "email", "statut", "solde_compte", "balance"];
    const attemptedSensitiveFields = sensitiveKeys.filter((key) => key in fields);

    if (attemptedSensitiveFields.length > 0) {
      console.warn(
        `[SECURITY ALERT] Tentative de modification non autorisée détectée sur un ou plusieurs champs sensibles (${attemptedSensitiveFields.join(", ")}) pour l'utilisateur ${targetUid}:`,
        {
          attemptedFields: attemptedSensitiveFields,
          userId: targetUid,
          payload: fields
        }
      );
    }

    // Extraction et élimination stricte des champs sensibles
    const { role, rôle, id, uid, email, statut, ...safeFields } = fields as any;

    // Normalisation stricte pour utiliser 'telephone', 'avatar', 'limite_credit' tout en conservant la compatibilité locale
    if (safeFields.téléphone !== undefined || safeFields.phone !== undefined || safeFields.telephone !== undefined) {
      const val = safeFields.téléphone || safeFields.phone || safeFields.telephone;
      safeFields.telephone = val;
      safeFields.téléphone = val;
      safeFields.phone = val;
    }
    if (safeFields.logoUrl !== undefined || safeFields.avatar !== undefined) {
      const val = safeFields.logoUrl || safeFields.avatar;
      safeFields.avatar = val;
      safeFields.logoUrl = val;
    }
    if (safeFields.creditLimit !== undefined || safeFields.limite_credit !== undefined) {
      const val = safeFields.creditLimit !== undefined ? safeFields.creditLimit : safeFields.limite_credit;
      safeFields.limite_credit = val;
      safeFields.creditLimit = val;
    }

    setError(null);
    try {
      await userService.updateUser(targetUid, safeFields);
      setDbUser((prev) => (prev ? { ...prev, ...safeFields } : ({ uid: targetUid, ...safeFields } as FirebaseUser)));
    } catch (err: any) {
      setError(err.message || "Erreur de mise à jour du profil.");
      throw err;
    }
  };

  const authUserObject: AuthUserObject | null = firebaseUser
    ? {
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        email: firebaseUser.email || dbUser?.email || "",
        displayName: dbUser ? `${dbUser.prénom || ""} ${dbUser.nom || ""}`.trim() : firebaseUser.email,
        emailVerified: true,
        phoneNumber: firebaseUser.phoneNumber || dbUser?.téléphone || undefined,
        photoURL: firebaseUser.photoURL || undefined
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: firebaseUser,
        firebaseUser: authUserObject,
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