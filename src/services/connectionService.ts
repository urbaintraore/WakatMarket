import { Connection, Notification, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";
import { db } from "../data";
import { syncService } from "./syncService";

export async function ensureUserExistsInSupabase(user: { id: string; name?: string; companyName?: string; email?: string; phone?: string; role?: string }): Promise<void> {
  if (!supabase || !user?.id) return;
  try {
    const fullName = (user.name || user.companyName || "Utilisateur").trim();
    const parts = fullName.split(" ");
    const nom = parts[0] || fullName;
    const prenom = parts.slice(1).join(" ") || "";
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email || `${user.id}@wakatmarket.com`,
      nom: nom,
      prenom: prenom,
      company_name: user.companyName || fullName,
      telephone: user.phone || "",
      role: user.role || "RETAILER",
      statut: "ACTIVE",
      pays: "Burkina Faso",
      ville: "Ouagadougou"
    }, { onConflict: "id" });
  } catch (e) {
    console.warn("[ConnectionService] Notice ensureUserExistsInSupabase:", e);
  }
}

/**
 * Assure que les profils utilisateurs référencés existent dans le magasin local db.getUsers()
 */
export async function ensureUsersExistLocally(userIds: string[]): Promise<void> {
  const cleanIds = Array.from(new Set(userIds.filter(Boolean)));
  if (cleanIds.length === 0) return;

  const currentUsers = db.getUsers();
  const missingIds = cleanIds.filter(id => !currentUsers.some(u => u.id === id));
  if (missingIds.length === 0) return;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", missingIds);

      if (!error && data && data.length > 0) {
        const fetchedUsers: UserProfile[] = data.map((row: any) => {
          const prenom = (row.prenom || "").trim();
          const nom = (row.nom || "").trim();
          const fullName = [prenom, nom].filter(Boolean).join(" ").trim() || row.name || (row.email ? row.email.split("@")[0] : "") || "Partenaire";
          const company = (row.company_name || row.companyName || nom || fullName).trim();

          return {
            id: row.id,
            name: fullName,
            companyName: company || fullName,
            email: row.email || "",
            phone: row.telephone || row.phone || "",
            role: (row.role || row.rôle || UserRole.SEMI_WHOLESALER) as UserRole,
            status: (row.statut || "ACTIVE") as any,
            country: row.pays || "Burkina Faso",
            region: row.ville || "Ouagadougou",
            sector: row.quartier,
            latitude: row.latitude,
            longitude: row.longitude,
            avatar: row.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            balance: 0,
            address: [row.quartier, row.ville, row.pays].filter(Boolean).join(", ") || "Non spécifié"
          };
        });

        const map = new Map<string, UserProfile>();
        currentUsers.forEach(u => map.set(u.id, u));
        fetchedUsers.forEach(u => map.set(u.id, u));
        const combined = Array.from(map.values());

        db.saveUsers(combined);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("wakat_users_updated"));
        }
      }
    } catch (e) {
      console.warn("[ConnectionService] Exception in ensureUsersExistLocally:", e);
    }
  }
}

function getDeletedConnectionIds(): Set<string> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("wakat_deleted_connection_ids") : null;
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
}

function saveDeletedConnectionId(id: string) {
  try {
    if (typeof window === "undefined") return;
    const set = getDeletedConnectionIds();
    set.add(id);
    localStorage.setItem("wakat_deleted_connection_ids", JSON.stringify(Array.from(set)));
  } catch (e) {}
}

function getDeletedPartnerPairs(): Set<string> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("wakat_deleted_partner_pairs") : null;
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
}

function saveDeletedPartnerPair(id1: string, id2: string) {
  try {
    if (typeof window === "undefined") return;
    const set = getDeletedPartnerPairs();
    set.add(`${id1}:${id2}`);
    set.add(`${id2}:${id1}`);
    localStorage.setItem("wakat_deleted_partner_pairs", JSON.stringify(Array.from(set)));
  } catch (e) {}
}

function removeDeletedConnectionId(id: string) {
  try {
    if (typeof window === "undefined") return;
    const set = getDeletedConnectionIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem("wakat_deleted_connection_ids", JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
}

function removeDeletedPartnerPair(id1: string, id2: string) {
  try {
    if (typeof window === "undefined") return;
    const set = getDeletedPartnerPairs();
    let changed = false;
    if (set.has(`${id1}:${id2}`)) {
      set.delete(`${id1}:${id2}`);
      changed = true;
    }
    if (set.has(`${id2}:${id1}`)) {
      set.delete(`${id2}:${id1}`);
      changed = true;
    }
    if (changed) {
      localStorage.setItem("wakat_deleted_partner_pairs", JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
}

export const connectionService = {
  getDeletedConnectionIds,
  saveDeletedConnectionId,
  removeDeletedConnectionId,
  getDeletedPartnerPairs,
  saveDeletedPartnerPair,
  removeDeletedPartnerPair,

  /**
   * Envoyer une demande de connexion de partenariat B2B avec logs détaillés
   */
  async envoyerDemandeConnexion(
    demandeur: UserProfile,
    destinataireIdentifiantOrUser: string | UserProfile,
    notes: string = ""
  ): Promise<{ success: boolean; relationId: string; destinataireNom: string; message: string }> {
    console.log("=================================================================");
    console.log("[ConnectionService.envoyerDemandeConnexion] >>> PARTNER ADDITION FLOW STARTED");
    console.log("[ConnectionService] Demandeur (Sender) User ID:", demandeur?.id);
    console.log("[ConnectionService] Demandeur Details:", {
      id: demandeur?.id,
      name: demandeur?.name,
      companyName: demandeur?.companyName,
      role: demandeur?.role,
      email: demandeur?.email
    });

    let destinataireUser: { id: string; name: string; companyName?: string; role: UserRole; email?: string; phone?: string } | null = null;

    if (typeof destinataireIdentifiantOrUser === "object" && destinataireIdentifiantOrUser !== null) {
      destinataireUser = {
        id: destinataireIdentifiantOrUser.id,
        name: destinataireIdentifiantOrUser.name,
        companyName: destinataireIdentifiantOrUser.companyName,
        role: destinataireIdentifiantOrUser.role,
        email: destinataireIdentifiantOrUser.email,
        phone: destinataireIdentifiantOrUser.phone
      };
      console.log("[ConnectionService] Destinataire User Object directly provided:", destinataireUser);
    } else {
      const cleanIdentifiant = String(destinataireIdentifiantOrUser || "").trim().toLowerCase();
      console.log("[ConnectionService] Searching for partner with clean identifier:", cleanIdentifiant);

      if (!cleanIdentifiant) {
        console.error("[ConnectionService] Error: Empty identifier provided.");
        throw new Error("Veuillez saisir un identifiant, un email ou un nom d'entreprise valide.");
      }

      // A. Chercher dans Supabase profiles
      if (supabase) {
        try {
          console.log("[ConnectionService] Querying Supabase 'profiles' table for identifier:", cleanIdentifiant);
          const { data: users, error: searchError } = await supabase
            .from("profiles")
            .select("*")
            .or(`email.ilike.${cleanIdentifiant},telephone.ilike.${cleanIdentifiant},id.eq.${cleanIdentifiant}`);

          if (searchError) {
            console.warn("[ConnectionService] Supabase profile search returned error:");
            console.warn("[ConnectionService] Error Code:", searchError.code);
            console.warn("[ConnectionService] Error Message:", searchError.message);
            console.warn("[ConnectionService] Error Details:", searchError.details);
            console.warn("[ConnectionService] Error Hint:", searchError.hint);
          } else if (users && users.length > 0) {
            const row = users[0];
            destinataireUser = {
              id: row.id,
              name: [row.nom, row.prenom].filter(Boolean).join(" ").trim() || "Utilisateur",
              companyName: row.company_name || row.nom,
              role: (row.role || UserRole.SEMI_WHOLESALER) as UserRole,
              email: row.email,
              phone: row.telephone
            };
            console.log("[ConnectionService] Found destinataire in Supabase 'profiles':", destinataireUser);
          } else {
            console.log("[ConnectionService] No user matched in Supabase 'profiles' table.");
          }
        } catch (e) {
          console.warn("[ConnectionService] Supabase profile search exception:", e);
        }
      }

      // B. Si non trouvé dans Supabase, chercher dans la base locale
      if (!destinataireUser) {
        console.log("[ConnectionService] Searching in local DB (db.getUsers)...");
        const localUsers = db.getUsers();
        const found = localUsers.find(u => {
          const email = (u.email || "").toLowerCase();
          const phone = (u.phone || "").toLowerCase();
          const comp = (u.companyName || "").toLowerCase();
          const name = (u.name || "").toLowerCase();
          const uid = (u.id || "").toLowerCase();
          return email === cleanIdentifiant ||
                 phone === cleanIdentifiant ||
                 uid === cleanIdentifiant ||
                 (cleanIdentifiant.length >= 3 && (comp.includes(cleanIdentifiant) || name.includes(cleanIdentifiant)));
        });

        if (found) {
          destinataireUser = {
            id: found.id,
            name: found.name,
            companyName: found.companyName,
            role: found.role,
            email: found.email,
            phone: found.phone
          };
          console.log("[ConnectionService] Found destinataire in local DB:", destinataireUser);
        }
      }
    }

    if (!destinataireUser) {
      console.error("[ConnectionService] PARTNER ADDITION FAILED: No user found matching identifier:", destinataireIdentifiantOrUser);
      throw new Error(`Aucun partenaire trouvé avec l'identifiant "${destinataireIdentifiantOrUser}". Vérifiez le nom, l'email ou le téléphone.`);
    }

    if (destinataireUser.id === demandeur.id) {
      console.error("[ConnectionService] PARTNER ADDITION FAILED: Attempted to add self as partner. ID:", demandeur.id);
      throw new Error("Vous ne pouvez pas vous ajouter vous-même comme partenaire d'affaires.");
    }

    const relationId = [demandeur.id, destinataireUser.id].sort().join("_");
    
    // Résolution rigoureuse du profil et du nom réel de l'émetteur
    let senderProfile: UserProfile = demandeur;
    const localSender = db.getUsers().find(u => u.id === demandeur.id);
    if (localSender) {
      senderProfile = { ...localSender, ...demandeur };
    }

    const demandeurNom = (senderProfile.name && senderProfile.name !== "Utilisateur" && senderProfile.name !== "Partenaire")
      ? senderProfile.name
      : (senderProfile.companyName || senderProfile.email || "Utilisateur");

    const demandeurFullDisplay = senderProfile.companyName && senderProfile.companyName !== demandeurNom
      ? `${demandeurNom} (${senderProfile.companyName})`
      : demandeurNom;

    const destinataireNom = (destinataireUser.name && destinataireUser.name !== "Utilisateur" && destinataireUser.name !== "Partenaire")
      ? destinataireUser.name
      : (destinataireUser.companyName || destinataireUser.email || "Partenaire");

    const destinataireFullDisplay = destinataireUser.companyName && destinataireUser.companyName !== destinataireNom
      ? `${destinataireNom} (${destinataireUser.companyName})`
      : destinataireNom;

    // Re-enable if was previously deleted
    removeDeletedConnectionId(relationId);
    removeDeletedPartnerPair(demandeur.id, destinataireUser.id);

    console.log(`[Pipeline Partenariat - Étape 1/7] Émetteur identifié : ID=${demandeur.id}, Nom='${demandeurNom}', Entreprise='${senderProfile.companyName || 'N/A'}', Rôle=${demandeur.role}`);
    console.log(`[Pipeline Partenariat - Étape 2/7] Destinataire résolu : ID=${destinataireUser.id}, Nom='${destinataireNom}', Entreprise='${destinataireUser.companyName || 'N/A'}', Rôle=${destinataireUser.role}`);
    console.log(`[Pipeline Partenariat - Étape 3/7] Identifiant relation généré : ${relationId}`);

    // Check existing connection
    const existingConn = db.getConnections().find(c => c.id === relationId);
    if (existingConn && (existingConn.status === "active" || (existingConn.status as string) === "actif")) {
      return {
        success: true,
        relationId,
        destinataireNom,
        message: `Vous êtes déjà connecté en tant que partenaire actif avec ${destinataireNom}.`
      };
    }
    if (existingConn && (existingConn.status === "en_attente" || (existingConn.status as string) === "PENDING" || (existingConn.status as string) === "pending")) {
      return {
        success: true,
        relationId,
        destinataireNom,
        message: `Une demande de partenariat est déjà en attente de confirmation avec ${destinataireNom}.`
      };
    }

    // C. Mettre à jour la base locale
    const nowIso = new Date().toISOString();
    const newConnection: Connection = {
      id: relationId,
      senderId: demandeur.id,
      receiverId: destinataireUser.id,
      status: "en_attente",
      senderName: demandeurNom,
      senderRole: demandeur.role,
      receiverName: destinataireNom,
      receiverRole: destinataireUser.role,
      notes,
      createdAt: existingConn ? existingConn.createdAt : nowIso,
      updatedAt: nowIso
    };

    const currentConns = db.getConnections();
    const filteredConns = currentConns.filter(c => c.id !== relationId);
    db.saveConnections([...filteredConns, newConnection]);
    console.log(`[Pipeline Partenariat - Étape 4/7] Relation locale sauvegardée (#${relationId}, statut: en_attente)`);

    // D. Notification locale pour le destinataire avec le vrai nom de la personne
    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: destinataireUser.id,
      senderId: demandeur.id,
      type: "demande_connexion",
      title: `Demande de partenariat de ${demandeurNom}`,
      message: `${demandeurFullDisplay} (${demandeur.role}) souhaite établir un partenariat commercial avec vous.`,
      read: false,
      relatedId: relationId,
      relationId: relationId,
      createdAt: nowIso
    };
    const currentNotifs = db.getNotifications();
    db.saveNotifications([newNotif, ...currentNotifs]);
    console.log(`[Pipeline Partenariat - Étape 5/7] Notification créée pour destinataire ${destinataireUser.id} (#${newNotif.id})`);

    // Declencher les evenements UI pour les deux parties
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_connections_updated"));
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
      window.dispatchEvent(new CustomEvent("wakat_users_updated"));
    }

    // Ensure both sender and receiver profiles exist in Supabase so foreign key constraints succeed
    if (supabase) {
      await ensureUserExistsInSupabase(senderProfile);
      await ensureUserExistsInSupabase(destinataireUser);
    }

    // E. Synchronisation Supabase avec logs ultra détaillés du payload et codes d'erreur
    if (supabase) {
      const payloadSent = {
        id: relationId,
        grossiste_id: demandeur.id,
        client_id: destinataireUser.id,
        statut: "PENDING"
      };

      console.log(`[Pipeline Partenariat - Étape 6/7] Synchronisation Supabase 'relations' payload:`, payloadSent);

      try {
        const { data: relData, error: relError } = await supabase
          .from("relations")
          .upsert(payloadSent)
          .select();

        if (relError) {
          console.error("-----------------------------------------------------------------");
          console.error("[ConnectionService] Supabase UPSERT into 'relations' FAILED!");
          console.error("[ConnectionService] Error Code:", relError.code);
          console.error("[ConnectionService] Error Message:", relError.message);
          console.error("[ConnectionService] Error Details:", relError.details);
          console.error("[ConnectionService] Error Hint:", relError.hint);
          console.error("[ConnectionService] Full Payload that caused failure:", payloadSent);
          console.error("-----------------------------------------------------------------");
        } else {
          console.log("[ConnectionService] Supabase UPSERT into 'relations' SUCCESSFUL! Response data:", relData);
        }

        // Notification Supabase pour le destinataire
        const notifPayload: Record<string, any> = {
          id: newNotif.id,
          user_id: destinataireUser.id,
          title: newNotif.title,
          message: newNotif.message,
          type: "demande_connexion",
          metadata: { 
            related_id: relationId,
            relation_id: relationId,
            sender_id: demandeur.id,
            sender_name: demandeurNom,
            sender_role: demandeur.role
          },
          read: false
        };
        console.log("[ConnectionService] Sending payload to Supabase 'notifications' table:", notifPayload);

        const { data: notifData, error: notifError } = await supabase
          .from("notifications")
          .insert(notifPayload)
          .select();

        if (notifError) {
          console.warn("[ConnectionService] Supabase INSERT with metadata into 'notifications' failed, attempting standard format...", notifError);
          try {
            await supabase.from("notifications").insert({
              id: newNotif.id,
              user_id: destinataireUser.id,
              title: newNotif.title,
              message: newNotif.message,
              read: false
            });
            console.log("[ConnectionService] Standard Supabase notification inserted successfully!");
          } catch (retryErr) {
            console.error("[ConnectionService] Fallback notification insert exception:", retryErr);
          }
        } else {
          console.log("[ConnectionService] Supabase INSERT into 'notifications' SUCCESSFUL! Response:", notifData);
        }
      } catch (sbErr) {
        console.error("[ConnectionService] Exception thrown during Supabase partner addition sync:", sbErr);
      }
    } else {
      console.log("[ConnectionService] Supabase client is not initialized. Using local storage mode only.");
    }

    // F. Enfiler dans la SyncQueue pour garantir la réplication bidirectionnelle
    try {
      await syncService.enqueue("relation", relationId, "UPDATE", {
        id: relationId,
        grossiste_id: demandeur.id,
        client_id: destinataireUser.id,
        statut: "PENDING",
        senderId: demandeur.id,
        receiverId: destinataireUser.id,
        senderName: demandeurNom,
        senderRole: demandeur.role,
        receiverName: destinataireNom,
        receiverRole: destinataireUser.role,
        status: "en_attente"
      });
      console.log(`[Pipeline Partenariat - Étape 7/7] Opération relation #${relationId} ajoutée à la file de synchronisation (SyncQueue)`);
    } catch (qErr) {
      console.warn("[ConnectionService] syncQueue enqueue notice:", qErr);
    }

    console.log("[ConnectionService.envoyerDemandeConnexion] <<< PARTNER ADDITION FLOW COMPLETED");
    console.log("=================================================================");

    return {
      success: true,
      relationId,
      destinataireNom,
      message: `Demande de partenariat envoyée avec succès à ${destinataireNom} (En attente de confirmation).`
    };
  },

  async createConnectionRequest(
    sender: UserProfile,
    receiver: UserProfile | string,
    notes?: string,
    initialStatus: Connection["status"] = "en_attente"
  ): Promise<Connection> {
    console.log("[ConnectionService.createConnectionRequest] Called with sender:", sender?.id, "receiver:", typeof receiver === "object" ? receiver.id : receiver);
    await this.envoyerDemandeConnexion(sender, receiver, notes || "");
    const receiverId = typeof receiver === "object" ? receiver.id : receiver;
    const connectionId = [sender.id, receiverId].sort().join("_");
    const existing = db.getConnections().find(c => c.id === connectionId);
    if (existing) return existing;

    const receiverUser = typeof receiver === "object" ? receiver : db.getUsers().find(u => u.id === receiverId);
    return {
      id: connectionId,
      senderId: sender.id,
      receiverId: receiverId,
      status: initialStatus,
      senderName: sender.companyName || sender.name,
      senderRole: sender.role,
      receiverName: receiverUser?.companyName || receiverUser?.name || "Partenaire",
      receiverRole: receiverUser?.role || UserRole.RETAILER,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  async sendConnectionRequest(
    sender: UserProfile,
    receiver: UserProfile | string,
    notes?: string,
    initialStatus: Connection["status"] = "en_attente"
  ): Promise<Connection> {
    return this.createConnectionRequest(sender, receiver, notes, initialStatus);
  },

  /**
   * Diagnostic check that specifically validates if a relationship between two users is marked as 'active'
   * (in the `statut` column) before the messaging UI allows a message to be sent.
   * Performs check against the real Supabase schema (`grossiste_id`, `client_id`, `statut`).
   */
  async validateRelationshipActive(userAId: string, userBId: string): Promise<{
    isActive: boolean;
    statut: string;
    grossisteId?: string;
    clientId?: string;
    relationId?: string;
    details: string;
  }> {
    console.log("-----------------------------------------------------------------");
    console.log(`[ConnectionService Diagnostic Check] Validating active relationship status between userA (${userAId}) and userB (${userBId})...`);

    if (!userAId || !userBId) {
      const msg = "Identifiants d'utilisateurs manquants pour la vérification de la relation.";
      console.warn(`[ConnectionService Diagnostic Check] FAILED: ${msg}`);
      return { isActive: false, statut: "INVALID", details: msg };
    }

    if (userAId === userBId) {
      console.log(`[ConnectionService Diagnostic Check] Same user ID detected (${userAId}). Self-discussion validated as ACTIVE.`);
      return { isActive: true, statut: "ACTIF", grossisteId: userAId, clientId: userBId, details: "Auto-discussion autorisée." };
    }

    // 1. Check against real Supabase schema 'relations' with columns grossiste_id, client_id, statut
    if (supabase) {
      try {
        console.log(`[ConnectionService Diagnostic Check] Querying Supabase 'relations' table for grossiste_id/client_id = ${userAId} or ${userBId}`);
        const { data, error } = await supabase
          .from("relations")
          .select("id, grossiste_id, client_id, statut, created_at")
          .or(`grossiste_id.eq.${userAId},client_id.eq.${userAId}`);

        if (error) {
          console.warn("[ConnectionService Diagnostic Check] Supabase query error:", error.message, error.code, error.details);
        } else if (data && data.length > 0) {
          const match = data.find(
            (r: any) =>
              (r.grossiste_id === userAId && r.client_id === userBId) ||
              (r.grossiste_id === userBId && r.client_id === userAId)
          );

          if (match) {
            const rawStatut = String(match.statut || "").toUpperCase();
            const isActif = rawStatut === "ACTIF" || rawStatut === "ACTIVE";
            console.log(`[ConnectionService Diagnostic Check] Supabase relation row found! ID: ${match.id}, grossiste_id: ${match.grossiste_id}, client_id: ${match.client_id}, statut: '${match.statut}' (isActive=${isActif})`);

            return {
              isActive: isActif,
              statut: match.statut || "ACTIF",
              grossisteId: match.grossiste_id,
              clientId: match.client_id,
              relationId: match.id,
              details: isActif
                ? `Relation B2B active vérifiée dans Supabase entre ${match.grossiste_id} et ${match.client_id}.`
                : `Relation B2B trouvée mais le statut 'statut' est '${match.statut}'.`
            };
          } else {
            console.log(`[ConnectionService Diagnostic Check] No direct relation match found in Supabase results for pair (${userAId}, ${userBId}).`);
          }
        }
      } catch (sbErr) {
        console.warn("[ConnectionService Diagnostic Check] Exception querying Supabase relations table:", sbErr);
      }
    }

    // 2. Check local DB as secondary fallback
    const localConns = db.getConnections();
    const localConn = localConns.find(
      c => (c.senderId === userAId && c.receiverId === userBId) || (c.senderId === userBId && c.receiverId === userAId)
    );

    if (localConn) {
      const isLocalActive = localConn.status === "active" || (localConn.status as string) === "actif";
      console.log(`[ConnectionService Diagnostic Check] Local connection match found: id=${localConn.id}, status=${localConn.status} (isLocalActive=${isLocalActive})`);
      return {
        isActive: isLocalActive,
        statut: isLocalActive ? "ACTIF" : "EN_ATTENTE",
        relationId: localConn.id,
        grossisteId: localConn.senderId,
        clientId: localConn.receiverId,
        details: isLocalActive
          ? `Connexion locale active trouvée (#${localConn.id}).`
          : `Connexion locale trouvée au statut '${localConn.status}'.`
      };
    }

    console.log(`[ConnectionService Diagnostic Check] No relationship restriction found between ${userAId} and ${userBId}. Defaulting to ACTIVE for communication.`);
    console.log("-----------------------------------------------------------------");
    return {
      isActive: true,
      statut: "ACTIF",
      details: "Messagerie autorisée."
    };
  },

  async getRelationStatusFromSupabase(
    relationId?: string,
    userAId?: string,
    userBId?: string
  ): Promise<"en_attente" | "active" | "refusee" | "inconnu"> {
    if (supabase) {
      try {
        if (relationId) {
          const { data, error } = await supabase
            .from("relations")
            .select("id, statut, grossiste_id, client_id")
            .eq("id", relationId)
            .maybeSingle();

          if (!error && data) {
            const rawStatut = String(data.statut || "").toUpperCase();
            if (rawStatut === "ACTIF" || rawStatut === "ACTIVE") return "active";
            if (rawStatut === "BLOCKED" || rawStatut === "REFUSÉE" || rawStatut === "REFUSEE") return "refusee";
            return "en_attente";
          }
        }

        if (userAId && userBId) {
          const { data, error } = await supabase
            .from("relations")
            .select("id, statut, grossiste_id, client_id")
            .or(`and(grossiste_id.eq.${userAId},client_id.eq.${userBId}),and(grossiste_id.eq.${userBId},client_id.eq.${userAId})`)
            .maybeSingle();

          if (!error && data) {
            const rawStatut = String(data.statut || "").toUpperCase();
            if (rawStatut === "ACTIF" || rawStatut === "ACTIVE") return "active";
            if (rawStatut === "BLOCKED" || rawStatut === "REFUSÉE" || rawStatut === "REFUSEE") return "refusee";
            return "en_attente";
          }
        }
      } catch (err) {
        console.warn("[ConnectionService] Notice querying relation status from Supabase:", err);
      }
    }

    // Fallback to local DB cache
    const localConns = db.getConnections();
    const conn = relationId
      ? localConns.find(c => c.id === relationId)
      : (userAId && userBId
          ? localConns.find(c => (c.senderId === userAId && c.receiverId === userBId) || (c.senderId === userBId && c.receiverId === userAId))
          : null);

    if (conn) {
      if (conn.status === "active" || (conn as any).statut === "ACTIF") return "active";
      if (conn.status === "refusée" || (conn as any).statut === "BLOCKED") return "refusee";
      return "en_attente";
    }

    return "inconnu";
  },

  async acceptConnection(connectionId: string, currentUserId?: string): Promise<void> {
    console.log(`[ConnectionService.acceptConnection] 🚀 [START] Accepting connection #${connectionId} for user ${currentUserId || 'unknown'}...`);
    const currentConns = db.getConnections();
    let conn = currentConns.find(c => c.id === connectionId);

    // If connection was not in local cache, try fetching from Supabase
    if (!conn && supabase) {
      try {
        console.log(`[ConnectionService.acceptConnection] 🔍 Querying Supabase 'relations' table for missing connection id=${connectionId}...`);
        const { data } = await supabase.from("relations").select("*").eq("id", connectionId).maybeSingle();
        if (data) {
          console.log(`[ConnectionService.acceptConnection] ✅ Found relation in Supabase: grossiste_id=${data.grossiste_id}, client_id=${data.client_id}`);
          const allUsers = db.getUsers();
          const senderUser = allUsers.find(u => u.id === data.grossiste_id);
          const receiverUser = allUsers.find(u => u.id === data.client_id);
          conn = {
            id: data.id,
            senderId: data.grossiste_id,
            receiverId: data.client_id,
            status: "active",
            senderName: senderUser?.name || senderUser?.companyName || "Demandeur B2B",
            senderRole: senderUser?.role || UserRole.WHOLESALER,
            receiverName: receiverUser?.name || receiverUser?.companyName || "Partenaire B2B",
            receiverRole: receiverUser?.role || UserRole.RETAILER,
            notes: data.notes || "",
            createdAt: data.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
      } catch (e) {
        console.warn("[ConnectionService.acceptConnection] Notice fetching missing connection from Supabase:", e);
      }
    }

    // Update local connections list
    const nowIso = new Date().toISOString();
    let updated: Connection[];
    if (conn) {
      conn = { ...conn, status: "active", updatedAt: nowIso };
      const filtered = currentConns.filter(c => c.id !== connectionId);
      updated = [...filtered, conn];
    } else {
      updated = currentConns.map(c => c.id === connectionId ? { ...c, status: "active" as const, updatedAt: nowIso } : c);
      conn = updated.find(c => c.id === connectionId);
    }
    db.saveConnections(updated);
    console.log(`[ConnectionService.acceptConnection] 💾 Local storage saved with ${updated.length} connection(s).`);

    removeDeletedConnectionId(connectionId);
    if (conn) {
      removeDeletedPartnerPair(conn.senderId, conn.receiverId);

      const senderName = conn.senderName || "Votre partenaire B2B";
      const receiverName = conn.receiverName || "Votre partenaire B2B";

      // 1. Notification de déclenchement pour le DEMANDEUR (Sender)
      const senderNotif: Notification = {
        id: `notif-accept-sender-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: conn.senderId,
        type: "connexion_acceptee" as any,
        title: "Partenariat d'affaires établi & actif",
        message: `${receiverName} a validé votre demande de partenariat commercial. Votre relation d'affaires est désormais active : vous pouvez échanger des propositions commerciales, partager vos stocks et passer des commandes dès maintenant.`,
        read: false,
        relatedId: connectionId,
        relationId: connectionId,
        createdAt: nowIso
      };

      // 2. Notification de confirmation pour le DESTINATAIRE (Receiver)
      const receiverNotif: Notification = {
        id: `notif-accept-recv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: conn.receiverId,
        type: "connexion_acceptee" as any,
        title: "Partenariat d'affaires confirmé",
        message: `Votre partenariat d'affaires avec ${senderName} est désormais actif. Vous pouvez échanger des propositions commerciales et collaborer directement.`,
        read: false,
        relatedId: connectionId,
        relationId: connectionId,
        createdAt: nowIso
      };

      const currentNotifs = db.getNotifications();
      // Mark any existing pending request notification for current user as read
      const updatedNotifs = currentNotifs.map(n => {
        const notifRelId = (n as any).relationId || (n as any).relatedId || (n as any).metadata?.related_id || (n as any).metadata?.relation_id;
        if (notifRelId === connectionId) {
          return { ...n, read: true };
        }
        return n;
      });

      db.saveNotifications([senderNotif, receiverNotif, ...updatedNotifs]);
      console.log(`[ConnectionService.acceptConnection] 📬 Notifications generated and saved locally for sender (${conn.senderId}) & receiver (${conn.receiverId}).`);

      if (supabase) {
        try {
          console.log(`[ConnectionService.acceptConnection] 📡 Inserting notifications into Supabase 'notifications' table...`);
          const { error: notifInsertErr } = await supabase.from("notifications").insert([
            {
              id: senderNotif.id,
              user_id: conn.senderId,
              title: senderNotif.title,
              message: senderNotif.message,
              type: "connexion_acceptee",
              metadata: { related_id: connectionId, relation_id: connectionId },
              read: false
            },
            {
              id: receiverNotif.id,
              user_id: conn.receiverId,
              title: receiverNotif.title,
              message: receiverNotif.message,
              type: "connexion_acceptee",
              metadata: { related_id: connectionId, relation_id: connectionId },
              read: false
            }
          ]);
          if (notifInsertErr) {
            console.warn("[ConnectionService.acceptConnection] ⚠️ Supabase notification insert error:", notifInsertErr.message);
          } else {
            console.log(`[ConnectionService.acceptConnection] ✅ Supabase notifications inserted successfully.`);
          }
        } catch (e) {
          console.warn("Notice Supabase accept notifications:", e);
        }
      }
    }

    if (supabase) {
      try {
        console.log(`[ConnectionService.acceptConnection] 📡 Updating Supabase 'relations' table to statut='ACTIF' for id=${connectionId}...`);
        const { data: updateData, error: updateErr } = await supabase
          .from("relations")
          .update({ statut: "ACTIF", updated_at: nowIso })
          .eq("id", connectionId)
          .select();

        if (updateErr) {
          console.warn("[ConnectionService.acceptConnection] ⚠️ Supabase relation update error:", updateErr.message);
        } else {
          console.log(`[ConnectionService.acceptConnection] ✅ Supabase 'relations' updated successfully (statut=ACTIF):`, updateData);
        }
      } catch (e) {
        console.warn("Notice Supabase accept connection:", e);
      }
    }

    if (typeof window !== "undefined") {
      console.log(`[ConnectionService.acceptConnection] 📣 Dispatching window events 'wakat_connections_updated', 'wakat_notifications_updated', 'wakat_partnership_established'...`);
      window.dispatchEvent(new CustomEvent("wakat_connections_updated", {
        detail: { connectionId, status: "active", action: "accept", timestamp: nowIso }
      }));
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated", {
        detail: { connectionId, status: "active", action: "accept", timestamp: nowIso }
      }));
      window.dispatchEvent(new CustomEvent("wakat_users_updated"));
      if (conn) {
        window.dispatchEvent(new CustomEvent("wakat_partnership_established", {
          detail: { connection: conn, senderId: conn.senderId, receiverId: conn.receiverId, timestamp: nowIso }
        }));
      }
    }

    if (conn) {
      try {
        await syncService.enqueue("relation", connectionId, "UPDATE", {
          id: connectionId,
          grossiste_id: conn.senderId,
          client_id: conn.receiverId,
          statut: "ACTIF",
          status: "active"
        });
      } catch (e) {
        console.warn("Notice syncQueue enqueue accept:", e);
      }
    }

    console.log(`[ConnectionService.acceptConnection] 🎉 [DONE] Connection #${connectionId} successfully accepted and synchronized.`);
  },

  async rejectConnection(connectionId: string, currentUserId?: string): Promise<void> {
    console.log(`[ConnectionService.rejectConnection] 🛑 [START] Rejecting connection #${connectionId} for user ${currentUserId || 'unknown'}...`);
    const currentConns = db.getConnections();
    const updated = currentConns.map(c => c.id === connectionId ? { ...c, status: "refusée" as const, updatedAt: new Date().toISOString() } : c);
    db.saveConnections(updated);

    const conn = updated.find(c => c.id === connectionId) || currentConns.find(c => c.id === connectionId);

    // Send notification to the sender that request was rejected
    const nowIso = new Date().toISOString();
    const currentNotifs = db.getNotifications();
    const updatedNotifs = currentNotifs.map(n => {
      const notifRelId = (n as any).relationId || (n as any).relatedId || (n as any).metadata?.related_id;
      if (notifRelId === connectionId) {
        return { ...n, read: true };
      }
      return n;
    });

    if (conn) {
      const receiverName = conn.receiverName || "Votre interlocuteur";
      const rejectNotif: Notification = {
        id: `notif-reject-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: conn.senderId,
        type: "connexion_refusee" as any,
        title: "Demande de partenariat refusée",
        message: `${receiverName} a refusé la demande de partenariat commercial.`,
        read: false,
        relatedId: connectionId,
        relationId: connectionId,
        createdAt: nowIso
      };
      db.saveNotifications([rejectNotif, ...updatedNotifs]);

      if (supabase) {
        try {
          console.log(`[ConnectionService.rejectConnection] 📡 Inserting reject notification into Supabase for sender ${conn.senderId}...`);
          await supabase.from("notifications").insert({
            id: rejectNotif.id,
            user_id: conn.senderId,
            title: rejectNotif.title,
            message: rejectNotif.message,
            type: "connexion_refusee",
            metadata: { related_id: connectionId, relation_id: connectionId },
            read: false
          });
        } catch (e) {
          console.warn("Notice Supabase reject notif:", e);
        }
      }
    } else {
      db.saveNotifications(updatedNotifs);
    }

    if (supabase) {
      try {
        console.log(`[ConnectionService.rejectConnection] 📡 Updating Supabase 'relations' table to statut='BLOCKED' for id=${connectionId}...`);
        const { error: blockErr } = await supabase.from("relations").update({ statut: "BLOCKED", updated_at: nowIso }).eq("id", connectionId);
        if (blockErr) {
          console.warn("[ConnectionService.rejectConnection] ⚠️ Supabase relation block error:", blockErr.message);
        } else {
          console.log(`[ConnectionService.rejectConnection] ✅ Supabase 'relations' status set to BLOCKED.`);
        }
      } catch (e) {
        console.warn("Notice Supabase reject connection:", e);
      }
    }

    if (typeof window !== "undefined") {
      console.log(`[ConnectionService.rejectConnection] 📣 Dispatching window events for rejection...`);
      window.dispatchEvent(new CustomEvent("wakat_connections_updated", {
        detail: { connectionId, status: "refusée", action: "reject", timestamp: nowIso }
      }));
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated", {
        detail: { connectionId, status: "refusée", action: "reject", timestamp: nowIso }
      }));
      window.dispatchEvent(new CustomEvent("wakat_users_updated"));
    }

    if (conn) {
      try {
        await syncService.enqueue("relation", connectionId, "UPDATE", {
          id: connectionId,
          grossiste_id: conn.senderId,
          client_id: conn.receiverId,
          statut: "BLOCKED",
          status: "refusée"
        });
      } catch (e) {
        console.warn("Notice syncQueue enqueue reject:", e);
      }
    }

    console.log(`[ConnectionService.rejectConnection] 🛑 [DONE] Connection #${connectionId} successfully rejected.`);
  },

  async respondToConnectionRequest(
    connOrId: string | Connection, 
    action: "accept" | "reject" | "accepter" | "refuser" | "active" | "refusée" | string,
    currentUserId?: string
  ): Promise<void> {
    const connectionId = typeof connOrId === "string" ? connOrId : connOrId.id;
    const isAccept = action === "accept" || action === "accepter" || action === "active";
    
    console.log(`[ConnectionService.respondToConnectionRequest] 🎯 Received response request: action="${action}" (isAccept=${isAccept}), connectionId="${connectionId}", currentUserId="${currentUserId || 'unknown'}"`);

    if (isAccept) {
      await this.acceptConnection(connectionId, currentUserId);
    } else {
      await this.rejectConnection(connectionId, currentUserId);
    }

    // Explicit manual cache refresh and local synchronization
    console.log(`[ConnectionService.respondToConnectionRequest] ⚡ Triggering manual cache sync & window event broadcast for App.tsx state synchronization...`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_connections_updated", {
        detail: { connectionId, action: isAccept ? "accept" : "reject", timestamp: new Date().toISOString() }
      }));
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated", {
        detail: { connectionId, action: isAccept ? "accept" : "reject", timestamp: new Date().toISOString() }
      }));
      window.dispatchEvent(new CustomEvent("wakat_users_updated"));
    }
  },

  async deleteConnection(connectionId: string, senderId?: string, receiverId?: string): Promise<void> {
    console.log(`[ConnectionService.deleteConnection] Deleting connection id="${connectionId}", sId="${senderId}", rId="${receiverId}"`);
    const currentConns = db.getConnections();
    const target = currentConns.find(c => c.id === connectionId);
    const sId = senderId || target?.senderId;
    const rId = receiverId || target?.receiverId;

    saveDeletedConnectionId(connectionId);
    if (sId && rId) {
      saveDeletedPartnerPair(sId, rId);
    }

    const updated = currentConns.filter(c => {
      if (c.id === connectionId) return false;
      if (sId && rId) {
        if ((c.senderId === sId && c.receiverId === rId) || (c.senderId === rId && c.receiverId === sId)) {
          return false;
        }
      }
      return true;
    });
    db.saveConnections(updated);

    // Also remove from lightClients if matching
    try {
      const currentLightClients = db.getLightClients();
      const updatedLc = currentLightClients.filter(lc => {
        if (lc.id === connectionId) return false;
        if (sId && (lc.linkedUserId === sId || lc.id === sId)) return false;
        if (rId && (lc.linkedUserId === rId || lc.id === rId)) return false;
        return true;
      });
      if (updatedLc.length !== currentLightClients.length) {
        db.saveLightClients(updatedLc);
      }
    } catch (e) {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_connections_updated"));
      window.dispatchEvent(new CustomEvent("wakat_light_clients_updated"));
    }

    if (supabase) {
      try {
        await supabase.from("relations").delete().eq("id", connectionId);
      } catch (e) {
        console.warn("Notice Supabase delete connection by id:", e);
      }
      if (sId && rId) {
        try {
          await supabase
            .from("relations")
            .delete()
            .or(`and(grossiste_id.eq.${sId},client_id.eq.${rId}),and(grossiste_id.eq.${rId},client_id.eq.${sId})`);
        } catch (e) {
          console.warn("Notice Supabase delete relation by pair:", e);
        }
      }
    }
  },

  subscribeToUserConnections(userId: string, callback: (connections: Connection[]) => void): () => void {
    if (!userId) return () => {};

    const emitConnections = async () => {
      const deletedIds = getDeletedConnectionIds();
      const deletedPairs = getDeletedPartnerPairs();

      const localConns = db.getConnections().filter(c => {
        if (deletedIds.has(c.id)) return false;
        if (deletedPairs.has(`${c.senderId}:${c.receiverId}`) || deletedPairs.has(`${c.receiverId}:${c.senderId}`)) return false;
        return c.senderId === userId || c.receiverId === userId;
      });

      let mappedSb: Connection[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("relations")
            .select("*")
            .or(`grossiste_id.eq.${userId},client_id.eq.${userId}`);

          if (!error && data && data.length > 0) {
            // Auto-fetch any missing partner profiles into local db BEFORE mapping!
            const partnerUserIds = data.flatMap((r: any) => [r.grossiste_id, r.client_id]).filter(Boolean);
            await ensureUsersExistLocally(partnerUserIds);

            const allUsers = db.getUsers();
            mappedSb = data
              .filter((row: any) => {
                if (deletedIds.has(row.id)) return false;
                if (deletedPairs.has(`${row.grossiste_id}:${row.client_id}`) || deletedPairs.has(`${row.client_id}:${row.grossiste_id}`)) return false;
                return true;
              })
              .map((row: any) => {
                const senderUser = allUsers.find(u => u.id === row.grossiste_id);
                const receiverUser = allUsers.find(u => u.id === row.client_id);
                const isActif = row.statut === "ACTIF" || row.statut === "actif";

                const resolvedSenderName = senderUser 
                  ? (senderUser.name || senderUser.companyName || "Utilisateur") 
                  : (row.sender_name || row.grossiste_nom || "Partenaire B2B");

                const resolvedReceiverName = receiverUser
                  ? (receiverUser.name || receiverUser.companyName || "Utilisateur")
                  : (row.receiver_name || row.client_nom || "Partenaire B2B");

                return {
                  id: row.id,
                  senderId: row.grossiste_id,
                  receiverId: row.client_id,
                  status: isActif ? "active" : row.statut === "BLOCKED" ? "refusée" : "en_attente",
                  senderName: resolvedSenderName,
                  senderRole: senderUser?.role || UserRole.WHOLESALER,
                  receiverName: resolvedReceiverName,
                  receiverRole: receiverUser?.role || UserRole.RETAILER,
                  notes: row.notes || "",
                  createdAt: row.created_at || new Date().toISOString(),
                  updatedAt: row.created_at || new Date().toISOString()
                };
              });
          }
        } catch (e) {
          console.warn("Notice Supabase fetch connections:", e);
        }
      }

      const map = new Map<string, Connection>();
      localConns.forEach(c => map.set(c.id, c));
      mappedSb.forEach(c => {
        if (!map.has(c.id)) {
          map.set(c.id, c);
        } else {
          const existing = map.get(c.id)!;
          // Bulletproof status merge: once active or refusée, never downgrade back to pending
          let resolvedStatus = existing.status;
          if (existing.status === "active" || c.status === "active") {
            resolvedStatus = "active";
          } else if (existing.status === "refusée" || c.status === "refusée") {
            resolvedStatus = "refusée";
          }

          map.set(c.id, {
            ...existing,
            status: resolvedStatus,
            senderName: c.senderName && c.senderName !== "Utilisateur" && c.senderName !== "Partenaire B2B" ? c.senderName : existing.senderName,
            receiverName: c.receiverName && c.receiverName !== "Utilisateur" && c.receiverName !== "Partenaire B2B" ? c.receiverName : existing.receiverName,
            senderRole: c.senderRole || existing.senderRole,
            receiverRole: c.receiverRole || existing.receiverRole,
            notes: c.notes || existing.notes,
            updatedAt: c.updatedAt || existing.updatedAt
          });
        }
      });

      const mergedConns = Array.from(map.values()).filter(c => {
        if (deletedIds.has(c.id)) return false;
        if (deletedPairs.has(`${c.senderId}:${c.receiverId}`) || deletedPairs.has(`${c.receiverId}:${c.senderId}`)) return false;
        return true;
      });

      // Update local storage without re-triggering recursive local update events
      const allLocal = db.getConnections();
      const hasDifferences = mergedConns.some(mc => !allLocal.some(lc => lc.id === mc.id && lc.status === mc.status));
      if (hasDifferences) {
        const remaining = allLocal.filter(lc => !mergedConns.some(mc => mc.id === lc.id));
        try {
          localStorage.setItem("wakat_erp_v2_connections", JSON.stringify([...remaining, ...mergedConns]));
        } catch (e) {}
      }

      callback(mergedConns);
    };

    emitConnections();

    const handleLocalChange = () => {
      emitConnections();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_connections_updated", handleLocalChange);
    }

    let channel: any = null;
    if (supabase) {
      try {
        const uniqueId = Math.random().toString(36).substring(7);
        channel = supabase
          .channel(`public:relations_conn:${userId}:${uniqueId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "relations" },
            (payload: any) => {
              console.log(`[ConnectionService:Realtime] 📥 Supabase 'relations' postgres_changes event (${payload.eventType}) received for userId=${userId}:`, payload);
              emitConnections();
            }
          )
          .subscribe((status: string) => {
            console.log(`[ConnectionService:Realtime] 📡 Supabase relations channel status for ${userId}: ${status}`);
          });
      } catch (e) {
        console.warn("Notice Supabase channel conn:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalChange);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  },

  subscribeToUserNotifications(userId: string, callback: (notifications: any[]) => void): () => void {
    if (!userId) return () => {};

    console.log(`[NotificationService.subscribeToUserNotifications] Inscription aux notifications pour l'utilisateur ${userId}`);

    const emitNotifs = async () => {
      const localNotifs = db.getNotifications().filter(n => n.userId === userId || (n as any).user_id === userId);
      const mappedLocal = localNotifs.map(n => ({
        id: n.id,
        type: n.type || "demande_connexion",
        contenu: n.message || n.title,
        message: n.message || n.title,
        title: n.title || n.message,
        lu: Boolean(n.read),
        read: Boolean(n.read),
        relationId: (n as any).relationId || (n as any).relatedId,
        relatedId: (n as any).relatedId || (n as any).relationId,
        expediteurId: n.senderId || (n as any).sender_id,
        senderId: n.senderId || (n as any).sender_id,
        dateCreation: n.createdAt,
        timestamp: n.createdAt,
      }));

      let mappedSb: any[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (!error && data) {
            mappedSb = data.map((row: any) => ({
              id: row.id,
              type: row.type || "demande_connexion",
              contenu: row.message || row.title,
              message: row.message || row.title,
              title: row.title || row.message,
              lu: Boolean(row.read),
              read: Boolean(row.read),
              relationId: row.related_id || row.relation_id || (row.metadata?.related_id) || (row.metadata?.relationId) || (row as any).relationId,
              relatedId: row.related_id || row.relation_id || (row.metadata?.related_id) || (row.metadata?.relationId) || (row as any).relationId,
              expediteurId: row.sender_id || (row.metadata?.sender_id),
              senderId: row.sender_id || (row.metadata?.sender_id),
              dateCreation: row.created_at || new Date().toISOString(),
              timestamp: row.created_at || new Date().toISOString(),
            }));
          }
        } catch (e) {
          console.warn("[NotificationService] Notice Supabase fetch notifs:", e);
        }
      }

      const map = new Map<string, any>();
      mappedLocal.forEach(n => map.set(n.id, n));
      mappedSb.forEach(n => {
        if (!map.has(n.id)) map.set(n.id, n);
      });

      const totalList = Array.from(map.values());
      console.log(`[NotificationService.emitNotifs] Émission de ${totalList.length} notification(s) (${mappedLocal.length} locales, ${mappedSb.length} Supabase) pour l'utilisateur ${userId}`);
      callback(totalList);
    };

    emitNotifs();

    const handleLocalNotifChange = () => {
      emitNotifs();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_notifications_updated", handleLocalNotifChange);
    }

    let channel: any = null;
    if (supabase) {
      try {
        const uniqueId = Math.random().toString(36).substring(7);
        channel = supabase
          .channel(`public:notifications:${userId}:${uniqueId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
            (payload: any) => {
              console.log(`[NotificationService:Realtime] 📥 Supabase 'notifications' postgres_changes event (${payload.eventType}) received for userId=${userId}:`, payload);
              emitNotifs();
            }
          )
          .subscribe((status: string) => {
            console.log(`[NotificationService:Realtime] 📡 Supabase notifications channel status for ${userId}: ${status}`);
          });
      } catch (e) {
        console.warn("Notice Supabase channel notifs:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_notifications_updated", handleLocalNotifChange);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  },

  async markNotificationAsRead(arg1: string, arg2?: string): Promise<void> {
    const notifId = arg2 || arg1;
    if (!notifId) return;

    const notifs = db.getNotifications().map(n => n.id === notifId ? { ...n, read: true } : n);
    db.saveNotifications(notifs);

    if (supabase) {
      try {
        await supabase.from("notifications").update({ read: true }).eq("id", notifId);
      } catch (e) {
        console.warn("Notice mark notification read:", e);
      }
    }
  }
};
