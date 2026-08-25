import { Connection, Notification, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";
import { db } from "../data";
import { syncService } from "./syncService";

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
        const fetchedUsers: UserProfile[] = data.map((row: any) => ({
          id: row.id,
          name: [row.nom, row.prenom].filter(Boolean).join(" ").trim() || row.email?.split("@")[0] || "Utilisateur",
          companyName: row.company_name || row.nom || `${row.prenom || ""} ${row.nom || ""}`.trim() || "Entreprise Partenaire",
          email: row.email || "",
          phone: row.telephone || "",
          role: (row.role || UserRole.SEMI_WHOLESALER) as UserRole,
          status: (row.statut || "ACTIVE") as any,
          country: row.pays || "Burkina Faso",
          region: row.ville || "Ouagadougou",
          sector: row.quartier,
          latitude: row.latitude,
          longitude: row.longitude,
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          balance: 0,
          address: [row.quartier, row.ville, row.pays].filter(Boolean).join(", ") || "Non spécifié"
        }));

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

export const connectionService = {
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
    const demandeurNom = demandeur.companyName || demandeur.name;
    const destinataireNom = destinataireUser.companyName || destinataireUser.name || "Partenaire";

    console.log("[ConnectionService] Generated Relation ID:", relationId);
    console.log("[ConnectionService] Grossiste/Demandeur ID:", demandeur.id, "Nom:", demandeurNom);
    console.log("[ConnectionService] Client/Destinataire ID:", destinataireUser.id, "Nom:", destinataireNom);

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
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const currentConns = db.getConnections();
    const filteredConns = currentConns.filter(c => c.id !== relationId);
    db.saveConnections([...filteredConns, newConnection]);
    console.log("[ConnectionService] Local connection saved successfully to db.getConnections()");

    // D. Notification locale
    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: destinataireUser.id,
      type: "demande_connexion",
      title: "Demande de partenariat commercial",
      message: `${demandeurNom} (${demandeur.role}) souhaite collaborer avec vous.`,
      read: false,
      relatedId: relationId,
      createdAt: nowIso
    };
    const currentNotifs = db.getNotifications();
    db.saveNotifications([newNotif, ...currentNotifs]);
    console.log("[ConnectionService] Local notification saved successfully to db.getNotifications()");

    // Declencher les evenements UI pour les deux parties
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_connections_updated"));
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
      window.dispatchEvent(new CustomEvent("wakat_users_updated"));
    }

    // E. Synchronisation Supabase avec logs ultra détaillés du payload et codes d'erreur
    if (supabase) {
      const payloadSent = {
        id: relationId,
        grossiste_id: demandeur.id,
        client_id: destinataireUser.id,
        statut: "PENDING"
      };

      console.log("[ConnectionService] Sending payload to Supabase 'relations' table:");
      console.log(JSON.stringify(payloadSent, null, 2));

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

        // Notification Supabase
        const notifPayload = {
          id: newNotif.id,
          user_id: destinataireUser.id,
          title: newNotif.title,
          message: newNotif.message,
          type: "demande_connexion",
          metadata: { related_id: relationId },
          read: false
        };
        console.log("[ConnectionService] Sending payload to Supabase 'notifications' table:", notifPayload);

        const { data: notifData, error: notifError } = await supabase
          .from("notifications")
          .insert(notifPayload)
          .select();

        if (notifError) {
          console.error("[ConnectionService] Supabase INSERT into 'notifications' FAILED!");
          console.error("[ConnectionService] Notification Error Code:", notifError.code);
          console.error("[ConnectionService] Notification Error Message:", notifError.message);
          console.error("[ConnectionService] Notification Error Details:", notifError.details);
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
        statut: "ACTIF",
        senderId: demandeur.id,
        receiverId: destinataireUser.id,
        senderName: demandeurNom,
        senderRole: demandeur.role,
        receiverName: destinataireNom,
        receiverRole: destinataireUser.role,
        status: "active"
      });
      console.log(`[ConnectionService] Operation relation #${relationId} added to syncQueue`);
    } catch (qErr) {
      console.warn("[ConnectionService] syncQueue enqueue notice:", qErr);
    }

    console.log("[ConnectionService.envoyerDemandeConnexion] <<< PARTNER ADDITION FLOW COMPLETED");
    console.log("=================================================================");

    return {
      success: true,
      relationId,
      destinataireNom,
      message: `Partenariat établi avec succès avec ${destinataireNom}.`
    };
  },

  async createConnectionRequest(
    sender: UserProfile,
    receiver: UserProfile,
    notes?: string,
    initialStatus: Connection["status"] = "en_attente"
  ): Promise<Connection> {
    console.log("[ConnectionService.createConnectionRequest] Called with sender:", sender.id, "receiver:", receiver.id);
    await this.envoyerDemandeConnexion(sender, receiver, notes || "");
    const connectionId = [sender.id, receiver.id].sort().join("_");
    const existing = db.getConnections().find(c => c.id === connectionId);
    return existing || {
      id: connectionId,
      senderId: sender.id,
      receiverId: receiver.id,
      status: initialStatus,
      senderName: sender.companyName || sender.name,
      senderRole: sender.role,
      receiverName: receiver.companyName || receiver.name,
      receiverRole: receiver.role,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  async sendConnectionRequest(
    sender: UserProfile,
    receiver: UserProfile,
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

  async acceptConnection(connectionId: string, _currentUserId?: string): Promise<void> {
    console.log(`[ConnectionService.acceptConnection] Accepting connection #${connectionId}...`);
    const currentConns = db.getConnections();
    const updated = currentConns.map(c => c.id === connectionId ? { ...c, status: "active" as const, updatedAt: new Date().toISOString() } : c);
    db.saveConnections(updated);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_connections_updated"));
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
      window.dispatchEvent(new CustomEvent("wakat_users_updated"));
    }

    const conn = updated.find(c => c.id === connectionId);

    if (supabase) {
      try {
        await supabase.from("relations").update({ statut: "ACTIF" }).eq("id", connectionId);
      } catch (e) {
        console.warn("Notice Supabase accept connection:", e);
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
  },

  async rejectConnection(connectionId: string, _currentUserId?: string): Promise<void> {
    console.log(`[ConnectionService.rejectConnection] Rejecting connection #${connectionId}...`);
    const currentConns = db.getConnections();
    const updated = currentConns.map(c => c.id === connectionId ? { ...c, status: "refusée" as const, updatedAt: new Date().toISOString() } : c);
    db.saveConnections(updated);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_connections_updated"));
      window.dispatchEvent(new CustomEvent("wakat_notifications_updated"));
      window.dispatchEvent(new CustomEvent("wakat_users_updated"));
    }

    const conn = updated.find(c => c.id === connectionId);

    if (supabase) {
      try {
        await supabase.from("relations").update({ statut: "BLOCKED" }).eq("id", connectionId);
      } catch (e) {
        console.warn("Notice Supabase reject connection:", e);
      }
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
  },

  async respondToConnectionRequest(connOrId: string | Connection, action: "accept" | "reject" | "accepter" | "refuser" | "active" | "refusée" | string): Promise<void> {
    const connectionId = typeof connOrId === "string" ? connOrId : connOrId.id;
    if (action === "accept" || action === "accepter" || action === "active") {
      return this.acceptConnection(connectionId);
    } else {
      return this.rejectConnection(connectionId);
    }
  },

  async deleteConnection(connectionId: string): Promise<void> {
    const currentConns = db.getConnections();
    const updated = currentConns.filter(c => c.id !== connectionId);
    db.saveConnections(updated);

    if (supabase) {
      try {
        await supabase.from("relations").delete().eq("id", connectionId);
      } catch (e) {
        console.warn("Notice Supabase delete connection:", e);
      }
    }
  },

  subscribeToUserConnections(userId: string, callback: (connections: Connection[]) => void): () => void {
    if (!userId) return () => {};

    const emitConnections = async () => {
      const localConns = db.getConnections().filter(c => c.senderId === userId || c.receiverId === userId);

      let mappedSb: Connection[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("relations")
            .select("*")
            .or(`grossiste_id.eq.${userId},client_id.eq.${userId}`);

          if (!error && data) {
            const allUsers = db.getUsers();
            mappedSb = data.map((row: any) => {
              const senderUser = allUsers.find(u => u.id === row.grossiste_id);
              const receiverUser = allUsers.find(u => u.id === row.client_id);
              const isActif = row.statut === "ACTIF" || row.statut === "actif";

              return {
                id: row.id,
                senderId: row.grossiste_id,
                receiverId: row.client_id,
                status: isActif ? "active" : row.statut === "BLOCKED" ? "refusée" : "en_attente",
                senderName: senderUser?.companyName || senderUser?.name || "Grossiste/Partenaire",
                senderRole: senderUser?.role || UserRole.WHOLESALER,
                receiverName: receiverUser?.companyName || receiverUser?.name || "Client/Détaillant",
                receiverRole: receiverUser?.role || UserRole.RETAILER,
                notes: "",
                createdAt: row.created_at || new Date().toISOString(),
                updatedAt: row.created_at || new Date().toISOString()
              };
            });

            // Auto-fetch any missing partner profiles into local db
            const partnerUserIds = data.flatMap((r: any) => [r.grossiste_id, r.client_id]).filter(Boolean);
            ensureUsersExistLocally(partnerUserIds);
          }
        } catch (e) {
          console.warn("Notice Supabase fetch connections:", e);
        }
      }

      const map = new Map<string, Connection>();
      localConns.forEach(c => map.set(c.id, c));
      mappedSb.forEach(c => {
        if (!map.has(c.id)) map.set(c.id, c);
      });

      const mergedConns = Array.from(map.values());
      db.saveConnections(mergedConns);
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
            () => {
              emitConnections();
            }
          )
          .subscribe();
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

    const emitNotifs = async () => {
      const localNotifs = db.getNotifications().filter(n => n.userId === userId);
      const mappedLocal = localNotifs.map(n => ({
        id: n.id,
        type: n.type || "demande_connexion",
        contenu: n.message || n.title,
        message: n.message || n.title,
        title: n.title || n.message,
        lu: Boolean(n.read),
        read: Boolean(n.read),
        relatedId: (n as any).relatedId,
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
              relatedId: row.related_id || (row.metadata?.related_id) || (row.metadata?.relatedId) || (row as any).relatedId,
              dateCreation: row.created_at || new Date().toISOString(),
              timestamp: row.created_at || new Date().toISOString(),
            }));
          }
        } catch (e) {
          console.warn("Notice Supabase fetch notifs:", e);
        }
      }

      const map = new Map<string, any>();
      mappedLocal.forEach(n => map.set(n.id, n));
      mappedSb.forEach(n => {
        if (!map.has(n.id)) map.set(n.id, n);
      });

      callback(Array.from(map.values()));
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
            () => {
              emitNotifs();
            }
          )
          .subscribe();
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
