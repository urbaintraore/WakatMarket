import { db, handleFirestoreError, OperationType, auth } from "../firebase/firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { db as mockDb, filterMockData } from "../data";

export interface FirebaseUser {
  uid: string;
  nom: string;
  prénom: string;
  email: string;
  téléphone: string;
  rôle: string;
  dateCréation: string;
  statut: string;
  pays?: string;
  ville?: string;
  quartier?: string;
  latitude?: number;
  longitude?: number;
}

const LOCAL_STORAGE_PREFIX = "wakat_fb_users_v2_";

function getLocalUser(uid: string): FirebaseUser | null {
  try {
    const data = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${uid}`);
    if (data) {
      return JSON.parse(data) as FirebaseUser;
    }
  } catch (e) {
    console.error("Error reading from localStorage:", e);
  }
  return null;
}

function saveLocalUser(uid: string, user: FirebaseUser): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${uid}`, JSON.stringify(user));
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
  async createUser(user: FirebaseUser): Promise<void> {
    saveLocalUser(user.uid, user);
    try {
      const existingUsersRaw = localStorage.getItem("wakat_erp_v2_users");
      let usersList: any[] = existingUsersRaw ? JSON.parse(existingUsersRaw) : [];
      const profile = {
        id: user.uid,
        name: `${user.prénom || "Utilisateur"} ${user.nom}`,
        email: user.email,
        phone: user.téléphone,
        role: user.rôle as any,
        status: user.statut as any,
        country: user.pays || "Burkina Faso",
        region: user.ville || "Ouagadougou",
        sector: user.quartier,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        balance: 0,
        companyName: `${user.nom} Entreprise`,
        address: user.ville && user.quartier ? `${user.quartier}, ${user.ville}` : "Non spécifié"
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
      const sanitized = sanitizeForFirestore(user);
      await setDoc(doc(db, "users", user.uid), sanitized);
    } catch (error: any) {
      console.warn("Firestore setDoc failed during createUser (relying on offline fallback):", error.message || error);
    }
  },

  async getUser(uid: string): Promise<FirebaseUser | null> {
    const currentUser = auth.currentUser;
    const currentEmail = currentUser?.email || "";

    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data() as FirebaseUser;
        if ((data.email === "urbain.traore@yahoo.fr" || data.email === "urbain.traoreurb@gmail.com") && data.rôle !== "ADMIN") {
          data.rôle = "ADMIN" as any;
          try { await updateDoc(doc(db, "users", uid), { rôle: "ADMIN" }); } catch (e) {}
        }
        if (data.email === "sayouba@ujkz.bf" && data.rôle !== "SEMI_WHOLESALER") {
          data.rôle = "SEMI_WHOLESALER" as any;
          try { await updateDoc(doc(db, "users", uid), { rôle: "SEMI_WHOLESALER" }); } catch (e) {}
        }
        saveLocalUser(uid, data);
        return data;
      }
    } catch (error: any) {
      console.warn("Firestore error during getUser:", error);
    }

    const local = getLocalUser(uid);
    if (local) {
      if ((local.email === "urbain.traore@yahoo.fr" || local.email === "urbain.traoreurb@gmail.com") && local.rôle !== "ADMIN") {
        local.rôle = "ADMIN";
        saveLocalUser(uid, local);
      }
      if (local.email === "sayouba@ujkz.bf" && local.rôle !== "SEMI_WHOLESALER") {
        local.rôle = "SEMI_WHOLESALER";
        saveLocalUser(uid, local);
      }
      return local;
    }

    if (currentUser && currentUser.uid === uid) {
      const email = currentEmail;
      const emailPrefix = email.split("@")[0] || "utilisateur";
      const cleanName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      
      let determinedRole = "CLIENT";
      if (email === "sayouba@ujkz.bf") {
        determinedRole = "SEMI_WHOLESALER";
      } else if (email.includes("detaillant")) {
        determinedRole = "RETAILER";
      } else if (email.includes("demi-grossiste") || email.includes("demigros") || email.includes("semi")) {
        determinedRole = "SEMI_WHOLESALER";
      } else if (email.includes("grossiste") || email.includes("wholesaler")) {
        determinedRole = "WHOLESALER";
      } else if (email.includes("fabricant") || email.includes("manufacturer")) {
        determinedRole = "MANUFACTURER";
      } else if (email.includes("admin") || email === "urbain.traore@yahoo.fr" || email === "urbain.traoreurb@gmail.com") {
        determinedRole = "ADMIN";
      }

      const fallbackUser: FirebaseUser = {
        uid: uid,
        nom: cleanName,
        prénom: determinedRole === "RETAILER" ? "Détaillant" : "Utilisateur",
        email: email,
        téléphone: currentUser.phoneNumber || "",
        rôle: determinedRole,
        dateCréation: new Date().toISOString(),
        statut: "ACTIVE"
      };
      saveLocalUser(uid, fallbackUser);
      return fallbackUser;
    }

    return null;
  },

  async updateUser(uid: string, fields: Partial<FirebaseUser>): Promise<void> {
    const local = getLocalUser(uid);
    if (local) { if ((local.email === "urbain.traore@yahoo.fr" || local.email === "urbain.traoreurb@gmail.com") && local.rôle !== "ADMIN") { local.rôle = "ADMIN"; saveLocalUser(uid, local); }
      saveLocalUser(uid, { ...local, ...fields });
    }
    try {
      const sanitized = sanitizeForFirestore(fields);
      await updateDoc(doc(db, "users", uid), sanitized);
    } catch (error: any) {
      console.warn("Firestore updateDoc failed during updateUser (relying on offline fallback):", error.message || error);
    }
  },

  async deleteUser(uid: string): Promise<void> {
    // 1. Remove from Firestore
    try {
      await deleteDoc(doc(db, "users", uid));
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
          firestoreUsers.push(docSnap.data() as FirebaseUser);
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
              localUsers.push(parsed);
            }
          }
        }
      }

      const erpUsersRaw = localStorage.getItem("wakat_erp_v2_users");
      if (erpUsersRaw) {
        const erpList: any[] = JSON.parse(erpUsersRaw);
        erpList.forEach(eu => {
          if (eu && eu.id) {
            localUsers.push({
              uid: eu.id,
              nom: eu.name?.split(" ").slice(1).join(" ") || eu.name || "",
              prénom: eu.name?.split(" ")[0] || "",
              email: eu.email || "",
              téléphone: eu.phone || "",
              rôle: eu.role || "CLIENT",
              dateCréation: new Date().toISOString(),
              statut: eu.status || "ACTIVE"
            });
          }
        });
      }
    } catch (e) {
      console.error("Error reading local users cache:", e);
    }

    const map = new Map<string, FirebaseUser>();
    [...localUsers, ...firestoreUsers].forEach(u => {
      map.set(u.uid, u);
    });

    if (auth.currentUser) {
      const cur = auth.currentUser;
      if (!map.has(cur.uid)) {
        map.set(cur.uid, {
          uid: cur.uid,
          nom: cur.displayName?.split(" ").slice(1).join(" ") || "Utilisateur",
          prénom: cur.displayName?.split(" ")[0] || "Firebase",
          email: cur.email || "",
          téléphone: cur.phoneNumber || "",
          rôle: "CLIENT",
          dateCréation: new Date().toISOString(),
          statut: "ACTIVE"
        });
      }
    }

    const finalArray = Array.from(map.values()).filter(u => u.statut !== "DELETED");
    finalArray.forEach(u => { 
      if ((u.email === "urbain.traore@yahoo.fr" || u.email === "urbain.traoreurb@gmail.com") && u.rôle !== "ADMIN") u.rôle = "ADMIN"; 
      if (u.email === "sayouba@ujkz.bf" && u.rôle !== "SEMI_WHOLESALER") u.rôle = "SEMI_WHOLESALER";
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
          users.push(doc.data() as FirebaseUser);
        });
        
        // Merge with local users for a complete picture
        this.getAllUsers().then(locals => {
          const map = new Map<string, FirebaseUser>();
          [...locals, ...users].forEach(u => map.set(u.uid, u));
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
