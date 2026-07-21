import { auth } from "../firebase/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  signInAnonymously,
  RecaptchaVerifier,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  User,
  ConfirmationResult
} from "firebase/auth";

export const authService = {
  async signUpWithEmail(email: string, password: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error("Erreur lors de l'inscription par e-mail:", error);
      throw error;
    }
  },

  async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      console.error("Erreur de connexion par e-mail:", error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
      throw error;
    }
  },

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Erreur réinitialisation mot de passe:", error);
      throw error;
    }
  },

  async configureSessionPersistence(keepLoggedIn: boolean): Promise<void> {
    try {
      const persistence = keepLoggedIn ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
    } catch (error) {
      console.error("Erreur lors de la configuration de la persistance:", error);
      throw error;
    }
  },

  // Recaptcha verifier for Phone OTP
  createRecaptchaVerifier(containerId: string, callback?: () => void): RecaptchaVerifier {
    try {
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: () => {
          if (callback) callback();
        },
        "expired-callback": () => {
          console.warn("Recaptcha expiré");
        }
      });
      return verifier;
    } catch (error) {
      console.error("Erreur création RecaptchaVerifier:", error);
      throw error;
    }
  },

  // Initiate SMS verification
  async requestPhoneOTP(phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> {
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      return confirmationResult;
    } catch (error) {
      console.error("Erreur lors de la demande de code OTP par téléphone:", error);
      throw error;
    }
  },

  // Confirm SMS verification
  async confirmPhoneOTP(confirmationResult: ConfirmationResult, code: string): Promise<User> {
    try {
      const result = await confirmationResult.confirm(code);
      return result.user;
    } catch (error) {
      console.error("Erreur lors de l'OTP:", error);
      throw error;
    }
  }
};
