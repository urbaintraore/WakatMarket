import { supabase } from "../supabase";
import { normalizeUserRole, UserRole, NumeroPaiement, isBonkoungou } from "../types";

export interface UserProfileData {
  uid: string;
  id?: string;
  nom: string;
  prénom: string;
  email: string;
  téléphone: string;
  phone?: string;
  rôle: string;
  role?: string;
  dateCréation?: string;
  statut: string;
  pays?: string;
  ville?: string;
  quartier?: string;
  latitude?: number;
  longitude?: number;
  companyName?: string;
  nomDEntreprise?: string;
  numerosPaiement?: NumeroPaiement[];
  balance?: number;
  creditLimit?: number;
  logoUrl?: string;
  address?: string;
  rccm?: string;
  ifu?: string;
}

// Alias for seamless backward compatibility across views
export type FirebaseUser = UserProfileData;

export const userService = {
  /**
   * Créer ou mettre à jour un profil dans PostgreSQL (table profiles)
   */
  async createUser(user: UserProfileData): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    let normRole = normalizeUserRole(user.rôle || user.role);
    if (user.email === "urbain.traore@yahoo.fr" || user.email === "urbain.traoreurb@gmail.com") {
      normRole = UserRole.ADMIN;
    } else if (isBonkoungou(user.email, user.companyName || user.nomDEntreprise, user.nom || user.prénom)) {
      normRole = UserRole.SEMI_WHOLESALER;
    }

    const fullName = `${user.prénom || ""} ${user.nom || ""}`.trim() || user.email.split("@")[0];

    const profileRecord = {
      id: user.uid,
      email: user.email.trim().toLowerCase(),
      name: fullName,
      phone: user.téléphone || user.phone || "",
      role: normRole,
      company_name: user.companyName || user.nomDEntreprise || "",
      address: [user.quartier, user.ville, user.pays].filter(Boolean).join(", ") || user.address || "",
      rccm: user.rccm || "",
      ifu: user.ifu || "",
      logo_url: user.logoUrl || "",
      balance: user.balance || 0,
      credit_limit: user.creditLimit || 0,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("profiles").upsert(profileRecord);
    if (error) {
      console.error("Erreur lors de l'enregistrement du profil Supabase (profiles):", error);
      throw error;
    }
  },

  /**
   * Récupérer un profil utilisateur par son ID depuis PostgreSQL
   */
  async getUser(uid: string): Promise<UserProfileData | null> {
    if (!supabase || !uid) return null;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.error("Erreur lecture profil Supabase:", error);
        return null;
      }

      if (!data) return null;

      let normRole = normalizeUserRole(data.role);
      if (data.email === "urbain.traore@yahoo.fr" || data.email === "urbain.traoreurb@gmail.com") {
        normRole = UserRole.ADMIN;
      } else if (isBonkoungou(data.email, data.company_name, data.name)) {
        normRole = UserRole.SEMI_WHOLESALER;
      }

      const nameParts = (data.name || "").split(" ");
      const prénom = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : data.name || "";
      const nom = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

      const userProfile: UserProfileData = {
        uid: data.id,
        id: data.id,
        nom: nom || data.name || "Utilisateur",
        prénom: prénom || "",
        email: data.email,
        téléphone: data.phone || "",
        phone: data.phone || "",
        rôle: normRole,
        role: normRole,
        dateCréation: data.created_at || new Date().toISOString(),
        statut: "ACTIF",
        companyName: data.company_name || "",
        nomDEntreprise: data.company_name || "",
        address: data.address || "",
        rccm: data.rccm || "",
        ifu: data.ifu || "",
        logoUrl: data.logo_url || "",
        balance: Number(data.balance || 0),
        creditLimit: Number(data.credit_limit || 0)
      };

      return userProfile;
    } catch (e) {
      console.error("Exception dans getUser:", e);
      return null;
    }
  },

  /**
   * Récupérer un utilisateur par email
   */
  async getUserByEmail(email: string): Promise<UserProfileData | null> {
    if (!supabase || !email) return null;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", email.trim())
        .maybeSingle();

      if (error || !data) return null;
      return this.getUser(data.id);
    } catch (e) {
      console.error("Exception dans getUserByEmail:", e);
      return null;
    }
  },

  /**
   * Mettre à jour des champs d'un profil
   */
  async updateUser(uid: string, fields: Partial<UserProfileData>): Promise<void> {
    if (!supabase || !uid) return;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (fields.nom || fields.prénom) {
      updates.name = `${fields.prénom || ""} ${fields.nom || ""}`.trim();
    }
    if (fields.téléphone || fields.phone) {
      updates.phone = fields.téléphone || fields.phone;
    }
    if (fields.companyName || fields.nomDEntreprise) {
      updates.company_name = fields.companyName || fields.nomDEntreprise;
    }
    if (fields.rôle || fields.role) {
      updates.role = normalizeUserRole(fields.rôle || fields.role);
    }
    if (fields.address) updates.address = fields.address;
    if (fields.rccm) updates.rccm = fields.rccm;
    if (fields.ifu) updates.ifu = fields.ifu;
    if (fields.logoUrl) updates.logo_url = fields.logoUrl;
    if (fields.balance !== undefined) updates.balance = fields.balance;
    if (fields.creditLimit !== undefined) updates.credit_limit = fields.creditLimit;

    const { error } = await supabase.from("profiles").update(updates).eq("id", uid);
    if (error) {
      console.error("Erreur update profil Supabase:", error);
      throw error;
    }
  },

  /**
   * Supprimer un profil
   */
  async deleteUser(uid: string): Promise<void> {
    if (!supabase || !uid) return;
    const { error } = await supabase.from("profiles").delete().eq("id", uid);
    if (error) {
      console.error("Erreur suppression profil Supabase:", error);
      throw error;
    }
  },

  /**
   * Récupérer tous les utilisateurs enregistrés dans PostgreSQL
   */
  async getAllUsers(): Promise<UserProfileData[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur récupération profiles Supabase:", error);
        return [];
      }

      return (data || []).map((row: any) => {
        let normRole = normalizeUserRole(row.role);
        if (row.email === "urbain.traore@yahoo.fr" || row.email === "urbain.traoreurb@gmail.com") {
          normRole = UserRole.ADMIN;
        } else if (isBonkoungou(row.email, row.company_name, row.name)) {
          normRole = UserRole.SEMI_WHOLESALER;
        }
        const nameParts = (row.name || "").split(" ");
        const prénom = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : row.name || "";
        const nom = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

        return {
          uid: row.id,
          id: row.id,
          nom: nom || row.name || "Utilisateur",
          prénom: prénom || "",
          email: row.email,
          téléphone: row.phone || "",
          phone: row.phone || "",
          rôle: normRole,
          role: normRole,
          dateCréation: row.created_at,
          statut: "ACTIF",
          companyName: row.company_name || "",
          nomDEntreprise: row.company_name || "",
          address: row.address || "",
          rccm: row.rccm || "",
          ifu: row.ifu || "",
          logoUrl: row.logo_url || "",
          balance: Number(row.balance || 0),
          creditLimit: Number(row.credit_limit || 0)
        };
      });
    } catch (e) {
      console.error("Exception dans getAllUsers:", e);
      return [];
    }
  },

  /**
   * Abonnement temps réel aux changements de profils
   */
  subscribeToUsers(callback: (users: UserProfileData[]) => void): () => void {
    if (!supabase) return () => {};

    // Initial fetch
    this.getAllUsers().then(callback);

    const channel = supabase
      .channel("public:profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          this.getAllUsers().then(callback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Alias pour subscribeToUsers
   */
  subscribeToAllUsers(callback: (users: UserProfileData[]) => void): () => void {
    return this.subscribeToUsers(callback);
  }
};
