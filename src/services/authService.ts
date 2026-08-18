import { supabase } from "../supabase";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

export interface SupabaseAuthUser extends User {}

export const authService = {
  /**
   * Inscription d'un utilisateur par e-mail et mot de passe via Supabase Auth
   */
  async signUpWithEmail(email: string, password: string, metadata?: Record<string, any>): Promise<{ user: User | null; session: Session | null }> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: metadata || {}
      }
    });

    if (error) {
      console.error("Erreur lors de l'inscription Supabase Auth:", error);
      throw error;
    }

    return { user: data.user, session: data.session };
  },

  /**
   * Connexion par e-mail et mot de passe via Supabase Auth
   */
  async signInWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null }> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      console.error("Erreur de connexion Supabase Auth:", error.message || error);
      throw error;
    }

    return { user: data.user, session: data.session };
  },

  /**
   * Déconnexion complète via Supabase Auth
   */
  async logout(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Erreur de déconnexion Supabase Auth:", error);
      throw error;
    }
  },

  /**
   * Réinitialisation de mot de passe par e-mail
   */
  async sendPasswordReset(email: string): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) {
      console.error("Erreur réinitialisation mot de passe:", error);
      throw error;
    }
  },

  /**
   * Récupérer l'utilisateur courant
   */
  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  },

  /**
   * Récupérer la session courante
   */
  async getSession(): Promise<Session | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) return null;
    return data.session;
  },

  /**
   * S'abonner aux changements d'état d'authentification
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    if (!supabase) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },

  /**
   * Configuration de la persistance de session (géré nativement par Supabase Client)
   */
  async configureSessionPersistence(_enablePersistence?: boolean): Promise<void> {
    // Supabase JS client handles local storage persistence automatically
    return;
  }
};
