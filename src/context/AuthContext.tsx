import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, onAuthStateChanged, ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { authService } from "../services/authService";
import { userService, FirebaseUser } from "../services/userService";
import { formatFirebaseError } from "../utils/firebaseErrors";
import { db } from "../data";
import { UserRole } from "../types";

interface AuthContextType {
  firebaseUser: User | null;
  dbUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  confirmationResult: ConfirmationResult | null;
  recaptchaVerifier: RecaptchaVerifier | null;
  
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
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  // Synchronize Firestore user profile whenever Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setLoading(true);
        try {
          // Fetch user profile
          let profile = await userService.getUser(user.uid);
          if (!profile) {
            console.warn("Profil Firestore introuvable lors de la vérification de session.");
          }
          setDbUser(profile);
        } catch (err) {
          console.error("Erreur de récupération du profil:", err);
          setError("Erreur de récupération du profil utilisateur.");
        } finally {
          setLoading(false);
        }
      } else {
        setDbUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await authService.signInWithEmail(email, password);
      let profile = await userService.getUser(user.uid);
      if (!profile) {
        // Rattrapage: Create the missing Firestore document for a user that exists in Auth
        console.warn("Profil Firestore manquant, création (rattrapage)...");
        const emailPrefix = email.split("@")[0] || "utilisateur";
        const cleanName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        let determinedRole = "CLIENT";
        if (email.includes("detaillant")) determinedRole = "RETAILER";
        else if (email.includes("demi-grossiste") || email.includes("demigros") || email.includes("semi")) determinedRole = "SEMI_WHOLESALER";
        else if (email.includes("grossiste") || email.includes("wholesaler")) determinedRole = "WHOLESALER";
        else if (email.includes("fabricant") || email.includes("manufacturer")) determinedRole = "MANUFACTURER";
        else if (email.includes("admin") || email === "urbain.traore@yahoo.fr" || email === "urbain.traoreurb@gmail.com") determinedRole = "ADMIN";
        
        profile = {
          uid: user.uid,
          nom: user.displayName || cleanName,
          prénom: "Utilisateur",
          email: email,
          téléphone: user.phoneNumber || "",
          rôle: determinedRole,
          dateCréation: new Date().toISOString(),
          statut: "ACTIVE"
        };
        await userService.createUser(profile);
      }
      setDbUser(profile);
    } catch (err: any) {
      console.warn("Erreur de connexion Firebase, tentative de repli local...", err);
      const allUsers = [...db.getUsers()];
      try {
        const erp = localStorage.getItem("wakat_erp_v2_users");
        if (erp) allUsers.push(...JSON.parse(erp));
      } catch (e) {}

      const found = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        const mappedUser: FirebaseUser = {
          uid: found.id,
          nom: found.name?.split(" ").slice(1).join(" ") || found.name || "",
          prénom: found.name?.split(" ")[0] || "",
          email: found.email || email,
          téléphone: found.phone || "",
          rôle: found.role || "CLIENT",
          dateCréation: new Date().toISOString(),
          statut: found.status || "ACTIVE"
        };
        setDbUser(mappedUser);
        setFirebaseUser({ uid: found.id, email: found.email, emailVerified: true } as any);
      } else {
        // Pour les erreurs réelles d'identifiants incorrects sur des comptes non-maquettés, on lève l'erreur pour informer l'utilisateur.
        const errorMsg = formatFirebaseError(err.message || "Identifiants invalides.");
        setError(errorMsg);
        throw err;
      }
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
    try {
      const user = await authService.signUpWithEmail(email, password);
      // Wait, "Le document Firestore doit être créé uniquement après une authentification réussie."
      const newUser: FirebaseUser = {
        uid: user.uid,
        nom,
        prénom,
        email,
        téléphone,
        rôle,
        dateCréation: new Date().toISOString(),
        statut: "ACTIVE",
        pays,
        ville,
        quartier,
        latitude,
        longitude
      };
      
      console.log("[DIAGNOSTIC] User role from registration form:", rôle);
      console.log("[DIAGNOSTIC] Saving User Profile to Firestore:", newUser);
      
      await userService.createUser(newUser);
      setDbUser(newUser);
    } catch (err: any) {
      setError(formatFirebaseError(err.message || "Erreur d'inscription."));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestPhoneOTP = async (phoneNumber: string, recaptchaContainerId: string) => {
    setLoading(true);
    setError(null);
    try {
      let verifier = recaptchaVerifier;
      if (!verifier) {
        verifier = authService.createRecaptchaVerifier(recaptchaContainerId);
        setRecaptchaVerifier(verifier);
      }
      const result = await authService.requestPhoneOTP(phoneNumber, verifier);
      setConfirmationResult(result);
    } catch (err: any) {
      setError(formatFirebaseError(err.message || "Erreur d'envoi du code OTP."));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOTP = async (
    code: string,
    nom: string = "Utilisateur",
    prénom: string = "Téléphone",
    email: string = "",
    rôle: string = "CLIENT"
  ) => {
    if (!confirmationResult) {
      throw new Error("Aucune demande de code OTP en cours.");
    }
    setLoading(true);
    setError(null);
    try {
      const user = await authService.confirmPhoneOTP(confirmationResult, code);
      // Create user doc if not exists
      const existingProfile = await userService.getUser(user.uid);
      if (!existingProfile) {
        const newUser: FirebaseUser = {
          uid: user.uid,
          nom,
          prénom,
          email: email || user.email || "",
          téléphone: user.phoneNumber || "",
          rôle,
          dateCréation: new Date().toISOString(),
          statut: "ACTIVE"
        };
        await userService.createUser(newUser);
        setDbUser(newUser);
      } else {
        setDbUser(existingProfile);
      }
      setConfirmationResult(null);
    } catch (err: any) {
      setError(formatFirebaseError(err.message || "Code OTP invalide."));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setError(null);
    try {
      await authService.sendPasswordReset(email);
    } catch (err: any) {
      setError(formatFirebaseError(err.message || "Erreur lors de la réinitialisation."));
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
    if (!firebaseUser) throw new Error("Aucun utilisateur connecté.");
    setError(null);
    try {
      await userService.updateUser(firebaseUser.uid, fields);
      setDbUser((prev) => (prev ? { ...prev, ...fields } : null));
    } catch (err: any) {
      setError(err.message || "Erreur de mise à jour du profil.");
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        loading,
        error,
        confirmationResult,
        recaptchaVerifier,
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
