import {
  isFirebaseConfigured,
  firebaseConfigError,
  isNetworkError,
  firestoreUpsert,
  firestoreGetById,
  firestoreGetWhere,
  firestoreGetAll,
  firestoreGetChunked,
  firestoreUpdate,
  firestoreDelete,
  firestoreSubscribe,
  subscribeSharedFirestore
} from "../firebase";
import { normalizeUserRole, UserRole, NumeroPaiement, isBonkoungou, isRootAdminEmail } from "../types";
import { profileToDb } from "./dbMappers";
import { db } from "../data";

// Cache de session pour l'index des profils (découverte de partenaires) :
// évite de re-parcourir Firestore à chaque frappe de recherche.
let profilesCache: UserProfileData[] | null = null;
let profilesCacheAt = 0;
let profilesInflight: Promise<UserProfileData[]> | null = null;
const PROFILES_CACHE_TTL = 15 * 60 * 1000;

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

function normalizeRow(row: any): UserProfileData | null {
  if (!row || !row.id) return null;
  let normRole = normalizeUserRole(row.role);
  if (isRootAdminEmail(row.email)) {
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
    dateCréation: row.created_at || new Date().toISOString(),
    statut: "ACTIF",
    companyName: row.company_name || fullName,
    nomDEntreprise: fullName,
    address: row.address || "",
    ville: row.ville || "",
    quartier: row.quartier || "",
    pays: row.pays || "Burkina Faso",
    logoUrl: row.avatar || "",
    balance: 0,
    creditLimit: Number(row.limite_credit || 0)
  };
}

export const userService = {
  /**
   * Créer ou mettre à jour un profil dans Firestore (collection 'profiles')
   */
  async createUser(user: UserProfileData): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error(`Firebase n'est pas initialisé. ${firebaseConfigError || ""}`);
    }

    let normRole = normalizeUserRole(user.rôle || user.role);
    if (isRootAdminEmail(user.email)) {
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
      phone: user.téléphone || user.phone || (user as any).telephone || "",
      role: normRole,
      address: [user.quartier, user.ville, user.pays].filter(Boolean).join(", ") || user.address || "",
      region: user.ville,
      country: user.pays,
      avatar: user.logoUrl || (user as any).avatar,
      creditLimit: user.creditLimit || (user as any).limite_credit || 0,
    });

    // Champs timing Firestore
    if (!profileRecord.created_at) profileRecord.created_at = user.dateCréation || new Date().toISOString();

    try {
      await firestoreUpsert("profiles", profileRecord);
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.warn("[profiles WRITE ERROR] Erreur écriture profiles Firestore:", err);
      }
    }
  },

  /**
   * Récupérer un profil utilisateur par son ID depuis Firestore
   */
  async getUser(uid: string): Promise<UserProfileData | null> {
    if (!isFirebaseConfigured() || !uid) return null;

    try {
      const row = await firestoreGetById("profiles", uid);
      if (!row) return null;
      return normalizeRow(row);
    } catch (e) {
      if (isNetworkError(e)) {
        console.warn("[userService] Réseau Firestore indisponible pour getUser (mode hors-ligne).");
      } else {
        console.error("Exception dans getUser:", e);
      }
      return null;
    }
  },

  /**
   * Récupérer un utilisateur par email
   */
  async getUserByEmail(email: string): Promise<UserProfileData | null> {
    if (!isFirebaseConfigured() || !email) return null;
    try {
      const rows = await firestoreGetWhere("profiles", "email", "==", email.trim().toLowerCase());
      if (!rows || rows.length === 0) return null;
      return normalizeRow(rows[0]);
    } catch (e) {
      if (isNetworkError(e)) return null;
      console.error("Exception dans getUserByEmail:", e);
      return null;
    }
  },

  /**
   * Récupérer un utilisateur par numéro de téléphone (filtrage local si besoin)
   */
  async getUserByPhone(phone: string): Promise<UserProfileData | null> {
    if (!isFirebaseConfigured() || !phone) return null;
    const cleanPhone = phone.replace(/\s+/g, "").trim();
    try {
      const rows = await firestoreGetAll("profiles");
      const found = rows
        .map(normalizeRow)
        .filter((p): p is UserProfileData => !!p)
        .find((p) => p.téléphone && p.téléphone.replace(/\s+/g, "").includes(cleanPhone));
      return found || null;
    } catch (e) {
      if (isNetworkError(e)) return null;
      console.error("Exception dans getUserByPhone:", e);
      return null;
    }
  },

  /**
   * Mettre à jour des champs d'un profil
   */
  async updateUser(uid: string, fields: Partial<UserProfileData>): Promise<void> {
    if (!isFirebaseConfigured() || !uid) return;

    const updates: Record<string, any> = {};

    if (fields.nom !== undefined) updates.nom = fields.nom;
    if (fields.prénom !== undefined) updates.prenom = fields.prénom;
    
    if (fields.téléphone !== undefined || fields.phone !== undefined || (fields as any).telephone !== undefined) {
      updates.telephone = fields.téléphone || fields.phone || (fields as any).telephone;
    }
    
    if (fields.rôle || fields.role) updates.role = normalizeUserRole(fields.rôle || fields.role);
    if (fields.address !== undefined) updates.address = fields.address;
    if (fields.ville !== undefined) updates.ville = fields.ville;
    if (fields.quartier !== undefined) updates.quartier = fields.quartier;
    if (fields.pays !== undefined) updates.pays = fields.pays;
    
    if (fields.logoUrl !== undefined || (fields as any).avatar !== undefined) {
      updates.avatar = fields.logoUrl || (fields as any).avatar;
    }
    
    if (fields.creditLimit !== undefined || (fields as any).limite_credit !== undefined) {
      updates.limite_credit = fields.creditLimit !== undefined ? fields.creditLimit : (fields as any).limite_credit;
    }

    if (Object.keys(updates).length === 0) return;

    try {
      await firestoreUpdate("profiles", uid, updates);
    } catch (err) {
      if (!isNetworkError(err)) {
        console.error("Erreur de mise à jour du profil Firestore:", err);
      }
      throw err;
    }
  },

  /**
   * Supprimer un profil
   */
  async deleteUser(uid: string): Promise<void> {
    if (!isFirebaseConfigured() || !uid) return;
    await firestoreDelete("profiles", uid);
  },

  /**
   * Récupérer tous les utilisateurs enregistrés dans Firestore
   * (pagination par chunks, avec cache de session pour la recherche partenaire)
   */
  async getAllUsers(): Promise<UserProfileData[]> {
    if (!isFirebaseConfigured()) return [];

    const now = Date.now();
    if (profilesCache && now - profilesCacheAt < PROFILES_CACHE_TTL) {
      return profilesCache;
    }

    // Onglet masqué : on sert le cache s'il existe, sinon on garde le seed
    // initial (jamais "gratuitement", une seule fois).
    const isHidden = typeof document !== "undefined" && document.hidden;
    if (isHidden && profilesCache) {
      return profilesCache;
    }

    // « Single-flight » : les appels concurrents partagent la même lecture.
    if (profilesInflight) return profilesInflight;

    profilesInflight = (async () => {
      try {
        const rows = await firestoreGetChunked("profiles", "created_at", 500, 4);
        const mapped = rows
          .map(normalizeRow)
          .filter((p): p is UserProfileData => !!p);
        profilesCache = mapped;
        profilesCacheAt = Date.now();
        return mapped;
      } catch (e) {
        if (isNetworkError(e)) {
          console.warn("[userService] Réseau Firestore indisponible pour getAllUsers (mode hors-ligne actif).");
        } else {
          console.error("Exception dans getAllUsers:", e);
        }
        return profilesCache || [];
      } finally {
        profilesInflight = null;
      }
    })();

    return profilesInflight;
  },

  /**
   * Recherche locale (cache + Firestore) — Firestore ne gère pas la recherche floue en base.
   */
  async searchUsers(queryText: string, role?: string, limit: number = 20): Promise<UserProfileData[]> {
    const q = queryText.trim();
    if (!q || q.length < 3) return [];

    try {
      let remote: UserProfileData[] = [];
      try {
        remote = await this.getAllUsers();
      } catch {
        remote = [];
      }

      const local = db.getUsers().map((u) => ({
        uid: u.id,
        id: u.id,
        nom: u.name?.split(" ")[0] || u.companyName || "Utilisateur",
        prénom: u.name?.split(" ").slice(1).join(" ") || "",
        email: u.email || "",
        téléphone: u.phone || "",
        phone: u.phone || "",
        rôle: normalizeUserRole(u.role),
        role: normalizeUserRole(u.role),
        dateCréation: undefined,
        statut: "ACTIF",
        companyName: u.companyName || u.name || "Entreprise"
      }) as UserProfileData);

      const map = new Map<string, UserProfileData>();
      remote.forEach((u) => u.uid && map.set(u.uid, u));
      local.forEach((u) => u.uid && map.set(u.uid, u));

      const needle = q.toLowerCase();
      const scored: { user: UserProfileData; score: number }[] = [];

      Array.from(map.values()).forEach((u) => {
        if (role && u.rôle !== role && u.role !== role) return;

        const fields = [
          u.nom || "",
          u.prénom || "",
          u.companyName || "",
          u.nomDEntreprise || "",
          u.email || "",
          u.téléphone || u.phone || ""
        ].map((f) => f.toLowerCase());

        let score = -1;
        fields.forEach((f) => {
          if (!f) return;
          if (f === needle) score = Math.max(score, 100);
          else if (f.startsWith(needle)) score = Math.max(score, 80);
          else if (f.includes(needle)) score = Math.max(score, 60);
        });

        if (score > 0) scored.push({ user: u, score });
      });

      scored.sort((a, b) => b.score - a.score || (a.user.email || "").localeCompare(b.user.email || ""));
      return scored.slice(0, limit).map((s) => s.user);
    } catch (e) {
      console.error("Exception dans searchUsers:", e);
      return [];
    }
  },

  /**
   * Abonnement temps réel aux changements de profils (Firestore onSnapshot)
   */
  subscribeToUsers(callback: (users: UserProfileData[]) => void): () => void {
    if (!isFirebaseConfigured()) return () => {};

    // Chargement initial depuis le cache local pour l'UI offline-first
    try {
      const local = db.getUsers();
      if (local && local.length > 0) {
        callback(
          local.map((u) => ({
            uid: u.id,
            id: u.id,
            nom: u.name?.split(" ")[0] || u.companyName || "Utilisateur",
            prénom: u.name?.split(" ").slice(1).join(" ") || "",
            email: u.email || "",
            téléphone: u.phone || "",
            phone: u.phone || "",
            rôle: normalizeUserRole(u.role),
            role: normalizeUserRole(u.role),
            dateCréation: undefined,
            statut: "ACTIF",
            companyName: u.companyName || u.name || "Entreprise"
          })) as UserProfileData[]
        );
      }
    } catch {
      // ignore cache read
    }

    const mapRows = (rows: any[]) => {
      callback(
        rows
          .map(normalizeRow)
          .filter((p): p is UserProfileData => !!p)
      );
    };

    // Canal temps réel partagé (1 seul onSnapshot "profiles", pause onglet masqué).
    return subscribeSharedFirestore(
      "profiles",
      (emit) => firestoreSubscribe("profiles", (rows) => emit(rows)),
      mapRows
    );
  },

  /**
   * Alias pour subscribeToUsers
   */
  subscribeToAllUsers(callback: (users: UserProfileData[]) => void): () => void {
    return this.subscribeToUsers(callback);
  }
};