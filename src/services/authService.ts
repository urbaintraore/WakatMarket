import {
  getFirebaseAuth,
  subscribeAuth,
  getAuthUser,
  isFirebaseConfigured,
  firebaseConfigError
} from "../firebase";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile
} from "firebase/auth";

export interface FirebaseAuthUser extends User {}

export function formatFirebaseAuthError(error: any): string {
  const code = typeof error === "string" ? error : error?.code || error?.message || "";
  const msg = String(code).toLowerCase();

  if (msg.includes("email-not-confirmed") || msg.includes("unverified-email")) {
    return "E-mail non confirmé : Veuillez cliquer sur le lien de confirmation envoyé à votre adresse e-mail (ou désactiver l'étape d'exigence de vérification e-mail dans Firebase > Authentication > Settings).";
  }
  if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found") || msg.includes("invalid-email")) {
    return "Identifiants invalides : L'adresse e-mail ou le mot de passe est incorrect.";
  }
  if (msg.includes("email-already-in-use") || msg.includes("account-exists-with-different-credential")) {
    return "Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.";
  }
  if (msg.includes("weak-password")) {
    return "Le mot de passe doit comporter au moins 6 caractères.";
  }
  if (msg.includes("too-many-requests") || msg.includes("rate-limit")) {
    return "Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.";
  }
  if (msg.includes("network-request-failed") || msg.includes("failed") && msg.includes("fetch") || msg.includes("unavailable")) {
    return "Problème de connexion réseau. Veuillez vérifier votre connexion Internet.";
  }
  if (msg.includes("operation-not-allowed")) {
    return "Cette méthode de connexion n'est pas activée dans la console Firebase.";
  }
  if (msg.includes("invalid-action-code") || msg.includes("expired-action-code")) {
    return "Le lien de réinitialisation de mot de passe est invalide ou a expiré.";
  }

  return (typeof error === "string" ? error : error?.message) || "Une erreur est survenue lors de l'authentification.";
}

export const authService = {
  /**
   * Inscription d'un utilisateur par e-mail et mot de passe via Firebase Auth
   */
  async signUpWithEmail(email: string, password: string, metadata?: Record<string, any>): Promise<{ user: User | null; session: any }> {
    if (!isFirebaseConfigured()) {
      throw new Error(`Firebase n'est pas initialisé. ${firebaseConfigError || ""}`);
    }
    const auth = getFirebaseAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

    if (metadata) {
      const displayName = metadata.name || [metadata.prénom, metadata.nom].filter(Boolean).join(" ") || metadata.displayName || undefined;
      const photoURL = metadata.photoURL || undefined;
      if (displayName || photoURL) {
        try {
          await firebaseUpdateProfile(userCredential.user, {
            displayName: displayName || "",
            photoURL: photoURL || ""
          });
        } catch (e) {
          console.warn("Notice mise à jour du profil Firebase:", e);
        }
      }
    }

    return { user: userCredential.user, session: null };
  },

  /**
   * Connexion par e-mail et mot de passe via Firebase Auth
   */
  async signInWithEmail(email: string, password: string): Promise<{ user: User | null; session: any }> {
    if (!isFirebaseConfigured()) {
      throw new Error(`Firebase n'est pas initialisé. ${firebaseConfigError || ""}`);
    }
    const userCredential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim().toLowerCase(), password);
    return { user: userCredential.user, session: null };
  },

  /**
   * Déconnexion complète via Firebase Auth
   */
  async logout(): Promise<void> {
    if (!isFirebaseConfigured()) return;
    await signOut(getFirebaseAuth());
  },

  /**
   * Envoi d'un e-mail de réinitialisation de mot de passe
   */
  async sendPasswordReset(email: string): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error(`Firebase n'est pas initialisé. ${firebaseConfigError || ""}`);
    }
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim().toLowerCase());
  },

  /**
   * Récupérer l'utilisateur courant
   */
  async getCurrentUser(): Promise<User | null> {
    if (!isFirebaseConfigured()) return null;
    return getAuthUser();
  },

  /**
   * Jeton d'authentification Firebase (Bearer) pour les appels à l'API Render.
   */
  async getToken(): Promise<string | null> {
    if (!isFirebaseConfigured()) return null;
    const user = await getAuthUser();
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (e) {
      console.warn("Impossible d'obtenir le jeton Firebase :", e);
      return null;
    }
  },

  /**
   * Récupérer la session courante (Firebase n'a pas de session côté client)
   */
  async getSession(): Promise<any | null> {
    if (!isFirebaseConfigured()) return null;
    const user = await getAuthUser();
    return user ? { user } : null;
  },

  /**
   * S'abonner aux changements d'état d'authentification (Firebase onAuthStateChanged)
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!isFirebaseConfigured()) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    const unsubscribe = subscribeAuth((user) => {
      callback(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null);
    });
    return { data: { subscription: { unsubscribe } } };
  },

  /**
   * Persistance de session : gérée nativement par Firebase Auth (localStorage)
   */
  async configureSessionPersistence(_enablePersistence?: boolean): Promise<void> {
    return;
  }
};