import { supabase } from "../supabase";
import { normalizeUserRole, UserRole, NumeroPaiement, isBonkoungou } from "../types";
import { profileToDb } from "./dbMappers";

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
export type SupabaseUser = UserProfileData;

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

    const companyOrFullName = (user.companyName || user.nomDEntreprise || `${user.prénom || ""} ${user.nom || ""}`).trim();

    const profileRecord = profileToDb({
      id: user.uid,
      email: user.email.trim().toLowerCase(),
      name: companyOrFullName,
      companyName: companyOrFullName,
      phone: user.téléphone || user.phone || "",
      role: normRole,
      address: [user.quartier, user.ville, user.pays].filter(Boolean).join(", ") || user.address || "",
      region: user.ville,
      country: user.pays,
      avatar: user.logoUrl,
      creditLimit: user.creditLimit || 0,
    });

    try {
      const { error } = await supabase.from("profiles").upsert(profileRecord);
      if (error) {
        console.warn("Notice: Enregistrement dans table profiles Supabase:", error.message);
      }
    } catch (err) {
      console.warn("Notice: Exception lors de l'enregistrement du profil Supabase:", err);
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
      } else if (isBonkoungou(data.email, data.nom, data.prenom)) {
        normRole = UserRole.SEMI_WHOLESALER;
      }

      const fullName = [data.nom, data.prenom].filter(Boolean).join(" ").trim() || "Utilisateur";

      const userProfile: UserProfileData = {
        uid: data.id,
        id: data.id,
        nom: data.nom || fullName,
        prénom: data.prenom || "",
        email: data.email || "",
        téléphone: data.telephone || "",
        phone: data.telephone || "",
        rôle: normRole,
        role: normRole,
        dateCréation: data.created_at || new Date().toISOString(),
        statut: "ACTIF",
        companyName: fullName,
        nomDEntreprise: fullName,
        address: data.address || "",
        ville: data.ville || "",
        quartier: data.quartier || "",
        pays: data.pays || "Burkina Faso",
        logoUrl: data.avatar || "",
        balance: 0,
        creditLimit: Number(data.limite_credit || 0)
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

    const updates: Record<string, any> = {};

    if (fields.nom !== undefined) updates.nom = fields.nom;
    if (fields.prénom !== undefined) updates.prenom = fields.prénom;
    if (fields.téléphone || fields.phone) updates.telephone = fields.téléphone || fields.phone;
    if (fields.rôle || fields.role) updates.role = normalizeUserRole(fields.rôle || fields.role);
    if (fields.address !== undefined) updates.address = fields.address;
    if (fields.ville !== undefined) updates.ville = fields.ville;
    if (fields.quartier !== undefined) updates.quartier = fields.quartier;
    if (fields.pays !== undefined) updates.pays = fields.pays;
    if (fields.logoUrl !== undefined) updates.avatar = fields.logoUrl;
    if (fields.creditLimit !== undefined) updates.limite_credit = fields.creditLimit;

    if (Object.keys(updates).length === 0) return;

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
        } else if (isBonkoungou(row.email, row.nom, row.prenom)) {
          normRole = UserRole.SEMI_WHOLESALER;
        }
        const fullName = [row.nom, row.prenom].filter(Boolean).join(" ").trim() || "Utilisateur";

        return {
          uid: row.id,
          id: row.id,
          nom: row.nom || fullName,
          prénom: row.prenom || "",
          email: row.email || "",
          téléphone: row.telephone || "",
          phone: row.telephone || "",
          rôle: normRole,
          role: normRole,
          dateCréation: row.created_at,
          statut: "ACTIF",
          companyName: fullName,
          nomDEntreprise: fullName,
          address: row.address || "",
          ville: row.ville || "",
          quartier: row.quartier || "",
          pays: row.pays || "Burkina Faso",
          logoUrl: row.avatar || "",
          balance: 0,
          creditLimit: Number(row.limite_credit || 0)
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

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:profiles:${uniqueId}`)
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

