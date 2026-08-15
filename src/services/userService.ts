import { db, handleFirestoreError, OperationType, auth } from "../firebase/firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { db as mockDb, filterMockData } from "../data";
import { normalizeUserRole, UserRole, NumeroPaiement, isBonkoungou } from "../types";

export interface FirebaseUser {
  uid: string;
  nom: string;
  prénom: string;
  email: string;
  téléphone: string;
  rôle: string;
  role?: string;
  dateCréation: string;
  statut: string;
  pays?: string;
  ville?: string;
  quartier?: string;
  latitude?: number;
  longitude?: number;
  companyName?: string;
  numerosPaiement?: NumeroPaiement[];
}

const LOCAL_STORAGE_PREFIX = "wakat_fb_users_v2_";

export function getLocalUser(uid: string): FirebaseUser | null {
  try {
    const data = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${uid}`);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed) {
        const normRole = normalizeUserRole(parsed.rôle || parsed.role);
        parsed.rôle = normRole;
        parsed.role = normRole;
        return parsed as FirebaseUser;
      }
    }
  } catch (e) {
    console.error("Error reading from localStorage:", e);
  }
  return null;
}

export function saveLocalUser(uid: string, user: FirebaseUser): void {
  try {
    const normRole = normalizeUserRole(user.rôle || user.role);
    const completeUser = {
      ...user,
      rôle: normRole,
      role: normRole
    };
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${uid}`, JSON.stringify(completeUser));
  } catch (e) {
    console.error("Error writing to localStorage:", e);
  }
}

function sanitizeForFirestore<T extends object>(obj: T): T {
  const result = { ...obj } as any;
  Object.keys(result).forEach((key) => {
    if (result[key] === undefined) {
      delete result[key];
    } else if (result[key] !== null && typeof result[key] === "object") {
      result[key] = sanitizeForFirestore(result[key]);
    }
  });
  return result;
}

export const userService = {
  getLocalUser,
  saveLocalUser,

  async createUser(user: FirebaseUser): Promise<void> {
    const normRole = normalizeUserRole(user.rôle || user.role);
    const userToSave: FirebaseUser = {
      ...user,
      rôle: normRole,
      role: normRole
    };

    saveLocalUser(userToSave.uid, userToSave);
    try {
      const existingUsersRaw = localStorage.getItem("wakat_erp_v2_users");
      let usersList: any[] = existingUsersRaw ? JSON.parse(existingUsersRaw) : [];
      const profile = {
        id: userToSave.uid,
        name: `${userToSave.prénom || "Utilisateur"} ${userToSave.nom}`.trim(),
        email: userToSave.email,
        phone: userToSave.téléphone,
        role: normRole,
        status: userToSave.statut as any,
        country: userToSave.pays || "Burkina Faso",
        region: userToSave.ville || "Ouagadougou",
        sector: userToSave.quartier,
        latitude: userToSave.latitude,
        longitude: userToSave.longitude,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        balance: 0,
        companyName: userToSave.companyName || `${userToSave.nom} Entreprise`,
        address: userToSave.ville && userToSave.quartier ? `${userToSave.quartier}, ${userToSave.ville}` : "Non spécifié"
      };
      const idx = usersList.findIndex((u: any) => u.id === profile.id);
      if (idx !== -1) {
        usersList[idx] = { ...usersList[idx], ...profile };
      } else {
        usersList.push(profile);
      }
      localStorage.setItem("wakat_erp_v2_users", JSON.stringify(usersList));
    } catch (e) {
      console.error("Error updating erp_users in localStorage:", e);
    }

    try {
      const sanitized = sanitizeForFirestore(userToSave);
      // Write to both users and utilisateurs documents to ensure cross-system compatibility
      await Promise.allSettled([
        setDoc(doc(db, "users", userToSave.uid), sanitized),
        setDoc(doc(db, "utilisateurs", userToSave.uid), sanitized)
      ]);
    } catch (error: any) {
      console.warn("Firestore setDoc failed during createUser (relying on offline fallback):", error.message || error);
    }
  },

  async getUser(uid: string): Promise<FirebaseUser | null> {
    const currentUser = auth.currentUser;
    const currentEmail = currentUser?.email || "";

    try {
      // Check 'users' collection first, fallback to 'utilisateurs' collection
      let snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        snap = await getDoc(doc(db, "utilisateurs", uid));
      }

      if (snap.exists()) {
        const raw = snap.data();
        let normRole = normalizeUserRole(raw.rôle || raw.role || raw.userRole);

        // Check custom claims if current user
        if (currentUser && currentUser.uid === uid) {
          try {
            const tokenResult = await currentUser.getIdTokenResult();
            const claimRole = (tokenResult.claims.rôle as string) || (tokenResult.claims.role as string) || (tokenResult.claims.admin ? "ADMIN" : undefined);
            if (claimRole && claimRole !== "CLIENT" && normRole === "CLIENT") {
              normRole = normalizeUserRole(claimRole);
            }
          } catch (e) {}
        }

        const data = { 
          uid: snap.id, 
          ...raw,
          rôle: normRole,
          role: normRole
        } as FirebaseUser;

        if ((data.email === "urbain.traore@yahoo.fr" || data.email === "urbain.traoreurb@gmail.com") && data.rôle !== "ADMIN") {
          data.rôle = "ADMIN";
          data.role = "ADMIN";
          try { 
            await Promise.allSettled([
              setDoc(doc(db, "users", uid), { rôle: "ADMIN", role: "ADMIN" }, { merge: true }),
              setDoc(doc(db, "utilisateurs", uid), { rôle: "ADMIN", role: "ADMIN" }, { merge: true })
            ]);
          } catch (e) {}
        }
        if (isBonkoungou(data.email, data.companyName, `${data.prénom || ""} ${data.nom || ""}`)) {
          let updated = false;
          const updates: any = {};
          if (data.rôle !== "SEMI_WHOLESALER") {
            data.rôle = "SEMI_WHOLESALER";
            data.role = "SEMI_WHOLESALER";
            updates.rôle = "SEMI_WHOLESALER";
            updates.role = "SEMI_WHOLESALER";
            updated = true;
          }
          if (data.nom !== "BONKOUNGOU" || data.companyName !== "BONKOUNGOU Entreprise") {
            data.nom = "BONKOUNGOU";
            data.prénom = data.prénom || "Sayouba";
            data.companyName = "BONKOUNGOU Entreprise";
            updates.nom = "BONKOUNGOU";
            updates.prénom = data.prénom;
            updates.companyName = "BONKOUNGOU Entreprise";
            updated = true;
          }
          if (updated) {
            try { 
              await Promise.allSettled([
                setDoc(doc(db, "users", uid), updates, { merge: true }),
                setDoc(doc(db, "utilisateurs", uid), updates, { merge: true })
              ]);
            } catch (e) {}
          }
        }
        saveLocalUser(uid, data);
        return data;
      }
    } catch (error: any) {
      console.warn("Firestore error/timeout during getUser (using local fallback):", error.message || error);
    }

    const local = getLocalUser(uid);
    if (local) {
      if ((local.email === "urbain.traore@yahoo.fr" || local.email === "urbain.traoreurb@gmail.com") && local.rôle !== "ADMIN") {
        local.rôle = "ADMIN";
        local.role = "ADMIN";
        saveLocalUser(uid, local);
      }
      if (isBonkoungou(local.email, local.companyName, `${local.prénom || ""} ${local.nom || ""}`)) {
        let localUpdated = false;
        if (local.rôle !== "SEMI_WHOLESALER") {
          local.rôle = "SEMI_WHOLESALER";
          local.role = "SEMI_WHOLESALER";
          localUpdated = true;
        }
        if (local.nom !== "BONKOUNGOU" || local.companyName !== "BONKOUNGOU Entreprise") {
          local.nom = "BONKOUNGOU";
          local.prénom = local.prénom || "Sayouba";
          local.companyName = "BONKOUNGOU Entreprise";
          localUpdated = true;
        }
        if (localUpdated) {
          saveLocalUser(uid, local);
        }
      }
      return local;
    }

    if (currentUser && currentUser.uid === uid) {
      const email = currentEmail;
      const emailPrefix = email.split("@")[0] || "utilisateur";
      let cleanName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      let companyName: string | undefined = undefined;
      let firstName = "Utilisateur";
      let chosenRole: string | undefined = undefined;
      let userPays: string | undefined = undefined;
      let userVille: string | undefined = undefined;
      let userQuartier: string | undefined = undefined;
      let userLat: number | undefined = undefined;
      let userLng: number | undefined = undefined;

      // Check if there was a pending registration payload
      try {
        const pendingRaw = localStorage.getItem(`wakat_pending_signup_${email.toLowerCase().trim()}`);
        if (pendingRaw) {
          const p = JSON.parse(pendingRaw);
          if (p) {
            cleanName = p.nom || cleanName;
            firstName = p.prénom || firstName;
            chosenRole = p.rôle || p.role;
            companyName = p.companyName || (cleanName ? `${cleanName} Entreprise` : undefined);
            userPays = p.pays;
            userVille = p.ville;
            userQuartier = p.quartier;
            userLat = p.latitude;
            userLng = p.longitude;
          }
        }
        if (!chosenRole) {
          const sessRole = sessionStorage.getItem("wakat_last_signup_role");
          if (sessRole) chosenRole = sessRole;
        }
      } catch (e) {}
      
      let determinedRole = normalizeUserRole(chosenRole || "CLIENT");
      if (isBonkoungou(email, companyName, cleanName)) {
        determinedRole = UserRole.SEMI_WHOLESALER;
        cleanName = "BONKOUNGOU";
        firstName = firstName || "Sayouba";
        companyName = "BONKOUNGOU Entreprise";
      } else if (email.includes("detaillant")) {
        determinedRole = UserRole.RETAILER;
        firstName = "Détaillant";
      } else if (email.includes("demi-grossiste") || email.includes("demigros") || email.includes("semi")) {
        determinedRole = UserRole.SEMI_WHOLESALER;
      } else if (email.includes("grossiste") || email.includes("wholesaler")) {
        determinedRole = UserRole.WHOLESALER;
      } else if (email.includes("fabricant") || email.includes("manufacturer")) {
        determinedRole = UserRole.MANUFACTURER;
      } else if (email.includes("admin") || email === "urbain.traore@yahoo.fr" || email === "urbain.traoreurb@gmail.com") {
        determinedRole = UserRole.ADMIN;
      }

      const fallbackUser: FirebaseUser = {
        uid: uid,
        nom: cleanName,
        prénom: firstName,
        email: email,
        téléphone: currentUser.phoneNumber || "",
        rôle: determinedRole,
        role: determinedRole,
        dateCréation: new Date().toISOString(),
        statut: "ACTIVE",
        companyName: companyName,
        pays: userPays,
        ville: userVille,
        quartier: userQuartier,
        latitude: userLat,
        longitude: userLng
      };
      saveLocalUser(uid, fallbackUser);
      return fallbackUser;
    }

    return null;
  },

  async updateUser(uid: string, fields: Partial<FirebaseUser>): Promise<void> {
    const updatedFields = { ...fields };
    if (updatedFields.rôle || (updatedFields as any).role) {
      const normRole = normalizeUserRole(updatedFields.rôle || (updatedFields as any).role);
      updatedFields.rôle = normRole;
      (updatedFields as any).role = normRole;
    }

    const local = getLocalUser(uid);
    if (local) {
      if ((local.email === "urbain.traore@yahoo.fr" || local.email === "urbain.traoreurb@gmail.com") && local.rôle !== "ADMIN") {
        local.rôle = "ADMIN";
        local.role = "ADMIN";
      }
      saveLocalUser(uid, { ...local, ...updatedFields });
    }

    try {
      const erpUsersRaw = localStorage.getItem("wakat_erp_v2_users");
      if (erpUsersRaw) {
        const erpList: any[] = JSON.parse(erpUsersRaw);
        const idx = erpList.findIndex((u: any) => u.id === uid);
        if (idx !== -1) {
          if (updatedFields.nom !== undefined || updatedFields.prénom !== undefined) {
            const first = updatedFields.prénom !== undefined ? updatedFields.prénom : (erpList[idx].name?.split(" ")[0] || "");
            const last = updatedFields.nom !== undefined ? updatedFields.nom : (erpList[idx].name?.split(" ").slice(1).join(" ") || "");
            erpList[idx].name = `${first} ${last}`.trim();
          }
          if (updatedFields.téléphone !== undefined) erpList[idx].phone = updatedFields.téléphone;
          if (updatedFields.companyName !== undefined) erpList[idx].companyName = updatedFields.companyName;
          if (updatedFields.pays !== undefined) erpList[idx].country = updatedFields.pays;
          if (updatedFields.ville !== undefined) erpList[idx].region = updatedFields.ville;
          if (updatedFields.quartier !== undefined) erpList[idx].sector = updatedFields.quartier;
          if (updatedFields.latitude !== undefined) erpList[idx].latitude = updatedFields.latitude;
          if (updatedFields.longitude !== undefined) erpList[idx].longitude = updatedFields.longitude;
          if (updatedFields.rôle !== undefined) erpList[idx].role = normalizeUserRole(updatedFields.rôle);
          localStorage.setItem("wakat_erp_v2_users", JSON.stringify(erpList));
        }
      }
    } catch (e) {
      console.error("Error updating local ERP users in updateUser:", e);
    }

    try {
      const sanitized = sanitizeForFirestore(updatedFields);
      const firestorePromise = Promise.allSettled([
        setDoc(doc(db, "users", uid), sanitized, { merge: true }),
        setDoc(doc(db, "utilisateurs", uid), sanitized, { merge: true })
      ]);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore timeout - fallback local")), 2500)
      );
      await Promise.race([firestorePromise, timeoutPromise]);
    } catch (error: any) {
      console.warn("Firestore setDoc failed during updateUser (relying on offline fallback):", error.message || error);
    }
  },

  async deleteUser(uid: string): Promise<void> {
    // 1. Remove from Firestore ('users' and 'utilisateurs')
    try {
      await Promise.allSettled([
        deleteDoc(doc(db, "users", uid)),
        deleteDoc(doc(db, "utilisateurs", uid))
      ]);
    } catch (e) {
      console.error("Firestore error during deleteUser:", e);
      throw e;
    }

    // 2. Remove from local storage
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${uid}`);
    
    try {
      const erpUsersRaw = localStorage.getItem("wakat_erp_v2_users");
      if (erpUsersRaw) {
        const erpList: any[] = JSON.parse(erpUsersRaw);
        const filtered = erpList.filter(u => u.id !== uid);
        localStorage.setItem("wakat_erp_v2_users", JSON.stringify(filtered));
      }
    } catch (e) {
      console.error("Error updating local users during deletion:", e);
    }
  },

  async getAllUsers(): Promise<FirebaseUser[]> {
    const firestoreUsers: FirebaseUser[] = [];
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach((docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          const normRole = normalizeUserRole(raw.rôle || raw.role || raw.userRole);
          firestoreUsers.push({ 
            uid: docSnap.id, 
            ...raw,
            rôle: normRole,
            role: normRole
          } as FirebaseUser);
        }
      });
    } catch (error: any) {
      console.warn("Firestore error during getAllUsers:", error);
    }

    const localUsers: FirebaseUser[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data) as FirebaseUser;
            if (parsed && parsed.uid) {
              const normRole = normalizeUserRole(parsed.rôle || parsed.role);
              localUsers.push({
                ...parsed,
                rôle: normRole,
                role: normRole
              });
            }
          }
        }
      }

      const erpUsersRaw = localStorage.getItem("wakat_erp_v2_users");
      if (erpUsersRaw) {
        const erpList: any[] = JSON.parse(erpUsersRaw);
        erpList.forEach(eu => {
          if (eu && eu.id) {
            const normRole = normalizeUserRole(eu.role || eu.rôle);
            localUsers.push({
              uid: eu.id,
              nom: eu.name?.split(" ").slice(1).join(" ") || eu.name || "",
              prénom: eu.name?.split(" ")[0] || "",
              email: eu.email || "",
              téléphone: eu.phone || "",
              rôle: normRole,
              role: normRole,
              dateCréation: new Date().toISOString(),
              statut: eu.status || "ACTIVE",
              companyName: eu.companyName
            });
          }
        });
      }
    } catch (e) {
      console.error("Error reading local users cache:", e);
    }

    const map = new Map<string, FirebaseUser>();
    const emailToUidMap = new Map<string, string>();
    const companyToUidMap = new Map<string, string>();

    const addOrMergeUser = (u: FirebaseUser) => {
      if (!u) return;
      const rawEmail = u.email ? u.email.toLowerCase().trim() : "";
      const rawCompany = u.companyName ? u.companyName.toLowerCase().trim() : "";
      
      let normRole = normalizeUserRole(u.rôle || u.role);
      if (isBonkoungou(u.email, u.companyName, `${u.prénom || ""} ${u.nom || ""}`)) {
        normRole = UserRole.SEMI_WHOLESALER;
        u.nom = "BONKOUNGOU";
        u.prénom = u.prénom || "Sayouba";
        u.companyName = "BONKOUNGOU Entreprise";
      } else if (rawEmail === "urbain.traore@yahoo.fr" || rawEmail === "urbain.traoreurb@gmail.com") {
        normRole = UserRole.ADMIN;
      }
      u.rôle = normRole;
      u.role = normRole;

      const normEmail = u.email ? u.email.toLowerCase().trim() : "";
      const normCompany = u.companyName ? u.companyName.toLowerCase().trim() : "";

      let existingUid: string | undefined = undefined;
      if (normEmail && emailToUidMap.has(normEmail)) {
        existingUid = emailToUidMap.get(normEmail);
      } else if (normCompany && normCompany === "bonkoungou entreprise" && companyToUidMap.has(normCompany)) {
        existingUid = companyToUidMap.get(normCompany);
      } else if (u.uid && map.has(u.uid)) {
        existingUid = u.uid;
      }

      if (existingUid && map.has(existingUid)) {
        const existing = map.get(existingUid)!;
        // Never overwrite a non-CLIENT role with a default CLIENT
        const effectiveRole = (u.rôle && u.rôle !== UserRole.CLIENT) ? u.rôle : (existing.rôle || u.rôle);
        const merged: FirebaseUser = { 
          ...existing, 
          ...u, 
          uid: existingUid,
          rôle: effectiveRole,
          role: effectiveRole
        };
        map.set(existingUid, merged);
        if (normEmail) emailToUidMap.set(normEmail, existingUid);
        if (normCompany) companyToUidMap.set(normCompany, existingUid);
      } else {
        const targetUid = u.uid || `user-${Date.now()}`;
        u.uid = targetUid;
        map.set(targetUid, u);
        if (normEmail) emailToUidMap.set(normEmail, targetUid);
        if (normCompany) companyToUidMap.set(normCompany, targetUid);
      }
    };

    [...localUsers, ...firestoreUsers].forEach(u => addOrMergeUser(u));

    if (auth.currentUser) {
      const cur = auth.currentUser;
      const curEmail = cur.email ? cur.email.toLowerCase().trim() : "";
      if (curEmail && !emailToUidMap.has(curEmail) && !map.has(cur.uid)) {
        let initialRole: UserRole = UserRole.CLIENT;
        try {
          const pendingRaw = localStorage.getItem(`wakat_pending_signup_${curEmail}`);
          if (pendingRaw) {
            const p = JSON.parse(pendingRaw);
            if (p && (p.rôle || p.role)) initialRole = normalizeUserRole(p.rôle || p.role);
          }
        } catch (e) {}

        addOrMergeUser({
          uid: cur.uid,
          nom: cur.displayName?.split(" ").slice(1).join(" ") || "Utilisateur",
          prénom: cur.displayName?.split(" ")[0] || "Firebase",
          email: cur.email || "",
          téléphone: cur.phoneNumber || "",
          rôle: initialRole,
          role: initialRole,
          dateCréation: new Date().toISOString(),
          statut: "ACTIVE"
        });
      }
    }

    const finalArray = Array.from(map.values()).filter(u => u.statut !== "DELETED");
    finalArray.forEach(u => { 
      const normE = u.email ? u.email.toLowerCase().trim() : "";
      const normC = u.companyName ? u.companyName.toLowerCase().trim() : "";
      if ((normE === "urbain.traore@yahoo.fr" || normE === "urbain.traoreurb@gmail.com") && u.rôle !== UserRole.ADMIN) {
        u.rôle = UserRole.ADMIN;
        u.role = UserRole.ADMIN;
      }
      if (isBonkoungou(u.email, u.companyName, `${u.prénom || ""} ${u.nom || ""}`)) {
        u.rôle = UserRole.SEMI_WHOLESALER;
        u.role = UserRole.SEMI_WHOLESALER;
        u.nom = "BONKOUNGOU";
        u.prénom = u.prénom || "Sayouba";
        u.companyName = "BONKOUNGOU Entreprise";
      }
    });
    return finalArray;
  },

  /**
   * Real-time subscription to all users in Firestore
   */
  subscribeToAllUsers(callback: (users: FirebaseUser[]) => void) {
    const firestoreCollection = collection(db, "users");
    
    // Initial fetch of local users to be responsive
    this.getAllUsers().then(callback);

    let unsub = () => {};
    try {
      unsub = onSnapshot(firestoreCollection, (snapshot) => {
        const users: FirebaseUser[] = [];
        snapshot.forEach((doc: any) => {
          const raw = doc.data();
          const normRole = normalizeUserRole(raw.rôle || raw.role || raw.userRole);
          users.push({ 
            uid: doc.id, 
            ...raw,
            rôle: normRole,
            role: normRole
          } as FirebaseUser);
        });
        
        // Merge with local users for a complete picture
        this.getAllUsers().then(locals => {
          const map = new Map<string, FirebaseUser>();
          const emailMap = new Map<string, string>();
          const companyMap = new Map<string, string>();

          [...locals, ...users].forEach(u => {
            if (!u) return;
            const rawEmail = u.email ? u.email.toLowerCase().trim() : "";
            const rawCompany = u.companyName ? u.companyName.toLowerCase().trim() : "";
            let normRole = normalizeUserRole(u.rôle || u.role);
            if (isBonkoungou(u.email, u.companyName, `${u.prénom || ""} ${u.nom || ""}`)) {
              normRole = UserRole.SEMI_WHOLESALER;
              u.nom = "BONKOUNGOU";
              u.prénom = u.prénom || "Sayouba";
              u.companyName = "BONKOUNGOU Entreprise";
            } else if (rawEmail === "urbain.traore@yahoo.fr" || rawEmail === "urbain.traoreurb@gmail.com") {
              normRole = UserRole.ADMIN;
            }
            u.rôle = normRole;
            u.role = normRole;

            const normEmail = u.email ? u.email.toLowerCase().trim() : "";
            const normCompany = u.companyName ? u.companyName.toLowerCase().trim() : "";

            let targetUid: string | undefined = undefined;
            if (normEmail && emailMap.has(normEmail)) {
              targetUid = emailMap.get(normEmail);
            } else if (normCompany && normCompany === "bonkoungou entreprise" && companyMap.has(normCompany)) {
              targetUid = companyMap.get(normCompany);
            } else if (u.uid && map.has(u.uid)) {
              targetUid = u.uid;
            }

            if (targetUid && map.has(targetUid)) {
              const existing = map.get(targetUid)!;
              const effectiveRole = (u.rôle && u.rôle !== UserRole.CLIENT) ? u.rôle : (existing.rôle || u.rôle);
              map.set(targetUid, { 
                ...existing, 
                ...u, 
                uid: targetUid,
                rôle: effectiveRole,
                role: effectiveRole
              });
              if (normEmail) emailMap.set(normEmail, targetUid);
              if (normCompany) companyMap.set(normCompany, targetUid);
            } else {
              const idToUse = u.uid || `u-${Date.now()}`;
              map.set(idToUse, u);
              if (normEmail) emailMap.set(normEmail, idToUse);
              if (normCompany) companyMap.set(normCompany, idToUse);
            }
          });
          callback(Array.from(map.values()).filter(u => u.statut !== "DELETED"));
        });
      }, (error) => {
        console.warn("[userService] subscribeToAllUsers Firestore connection failed, relying on local storage fallback", error);
      });
    } catch (e) {
      console.warn("[userService] Failed to set up Firestore onSnapshot for all users:", e);
    }

    return () => {
      try {
        unsub();
      } catch (e) {
        console.warn("[userService] Failed to unsubscribe from all users:", e);
      }
    };
  }
};
