import { Connection, Notification, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";
import { db } from "../data";

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
      status: "active",
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
      title: "Nouveau partenaire d'affaires",
      message: `${demandeurNom} (${demandeur.role}) vous a ajouté comme partenaire commercial.`,
      read: false,
      relatedId: relationId,
      createdAt: nowIso
    };
    const currentNotifs = db.getNotifications();
    db.saveNotifications([newNotif, ...currentNotifs]);
    console.log("[ConnectionService] Local notification saved successfully to db.getNotifications()");

    // E. Synchronisation Supabase avec logs ultra détaillés du payload et codes d'erreur
    if (supabase) {
      const payloadSent = {
        id: relationId,
        grossiste_id: demandeur.id,
        client_id: destinataireUser.id,
        statut: "ACTIF"
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
          related_id: relationId,
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

  async acceptConnection(connectionId: string, _currentUserId?: string): Promise<void> {
    const currentConns = db.getConnections();
    const updated = currentConns.map(c => c.id === connectionId ? { ...c, status: "active" as const, updatedAt: new Date().toISOString() } : c);
    db.saveConnections(updated);

    if (supabase) {
      try {
        await supabase.from("relations").update({ statut: "ACTIF" }).eq("id", connectionId);
      } catch (e) {
        console.warn("Notice Supabase accept connection:", e);
      }
    }
  },

  async rejectConnection(connectionId: string, _currentUserId?: string): Promise<void> {
    const currentConns = db.getConnections();
    const updated = currentConns.map(c => c.id === connectionId ? { ...c, status: "refusée" as const, updatedAt: new Date().toISOString() } : c);
    db.saveConnections(updated);

    if (supabase) {
      try {
        await supabase.from("relations").update({ statut: "BLOCKED" }).eq("id", connectionId);
      } catch (e) {
        console.warn("Notice Supabase reject connection:", e);
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
              relatedId: row.related_id || (row as any).relatedId,
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
