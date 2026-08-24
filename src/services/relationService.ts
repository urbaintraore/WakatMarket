import { Connection, Notification, Relation, PartnerNotificationItem, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";
import { db } from "../data";
import { connectionService, ensureUsersExistLocally } from "./connectionService";

export const relationService = {
  /**
   * Inspecter et vérifier le statut de la connexion B2B entre deux utilisateurs (utilisant grossiste_id, client_id, statut)
   * avant d'autoriser la transmission de messages
   */
  async verifierRelationActive(userAId: string, userBId: string): Promise<{ isConnected: boolean; statut?: string; reason?: string }> {
    const diag = await connectionService.validateRelationshipActive(userAId, userBId);
    return {
      isConnected: diag.isActive,
      statut: diag.statut,
      reason: diag.details
    };
  },

  /**
   * 1. Envoyer ou créer une relation de partenariat d'affaires B2B
   */
  async envoyerDemandeConnexion(
    demandeur: UserProfile, 
    destinataireIdentifiant: string, 
    notes: string = ""
  ): Promise<{ success: boolean; relationId: string; destinataireNom: string; message: string }> {
    return connectionService.envoyerDemandeConnexion(demandeur, destinataireIdentifiant, notes);
  },

  /**
   * 2. Accepter une demande de connexion
   */
  async accepterDemandeConnexion(relationId: string, _destinataireId?: string): Promise<void> {
    return connectionService.acceptConnection(relationId, _destinataireId);
  },

  /**
   * 3. Refuser une demande de connexion
   */
  async refuserDemandeConnexion(relationId: string, _destinataireId?: string): Promise<void> {
    return connectionService.rejectConnection(relationId, _destinataireId);
  },

  /**
   * 4. Bloquer un partenaire
   */
  async bloquerPartenaire(relationId: string): Promise<void> {
    return this.refuserDemandeConnexion(relationId);
  },

  /**
   * 5. Supprimer une relation
   */
  async supprimerRelation(relationId: string): Promise<void> {
    return connectionService.deleteConnection(relationId);
  },

  /**
   * 6. Écouter les relations d'un utilisateur en temps réel
   */
  ecouterRelations(userId: string, callback: (relations: Relation[]) => void): () => void {
    if (!userId) return () => {};

    const emitRelations = async () => {
      // Source locale
      const localConns = db.getConnections().filter(c => c.senderId === userId || c.receiverId === userId);
      const mappedLocal: Relation[] = localConns.map(c => ({
        id: c.id,
        demandeurId: c.senderId,
        destinataireId: c.receiverId,
        statut: (c.status === "active" ? "actif" : c.status === "refusée" ? "refuse" : "en_attente") as any,
        dateCreation: c.createdAt,
        dateReponse: c.updatedAt,
        participants: [c.senderId, c.receiverId],
        notes: c.notes || "",
        demandeurNom: c.senderName,
        demandeurRole: c.senderRole,
        destinataireNom: c.receiverName,
        destinataireRole: c.receiverRole
      }));

      // Source Supabase
      let mappedSb: Relation[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("relations")
            .select("*")
            .or(`grossiste_id.eq.${userId},client_id.eq.${userId}`);

          if (!error && data) {
            const allUsers = db.getUsers();
            mappedSb = data.map((row: any) => {
              const demandeurUser = allUsers.find(u => u.id === row.grossiste_id);
              const destinataireUser = allUsers.find(u => u.id === row.client_id);
              return {
                id: row.id,
                demandeurId: row.grossiste_id,
                destinataireId: row.client_id,
                statut: (row.statut === "ACTIF" || row.statut === "actif" ? "actif" : row.statut === "BLOCKED" ? "refuse" : "en_attente") as any,
                dateCreation: row.created_at || new Date().toISOString(),
                dateReponse: row.created_at || new Date().toISOString(),
                participants: [row.grossiste_id, row.client_id].filter(Boolean),
                notes: "",
                demandeurNom: demandeurUser?.companyName || demandeurUser?.name || "Partenaire Demandeur",
                demandeurRole: demandeurUser?.role || UserRole.WHOLESALER,
                destinataireNom: destinataireUser?.companyName || destinataireUser?.name || "Partenaire Destinataire",
                destinataireRole: destinataireUser?.role || UserRole.RETAILER
              };
            });

            const userIds = data.flatMap((r: any) => [r.grossiste_id, r.client_id]).filter(Boolean);
            ensureUsersExistLocally(userIds);
          }
        } catch (e) {
          console.warn("Notice Supabase fetch relations:", e);
        }
      }

      // Fusionner sans doublons par ID
      const map = new Map<string, Relation>();
      mappedLocal.forEach(r => map.set(r.id, r));
      mappedSb.forEach(r => {
        if (!map.has(r.id)) map.set(r.id, r);
      });

      callback(Array.from(map.values()));
    };

    emitRelations();

    const handleLocalUpdate = () => {
      emitRelations();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_connections_updated", handleLocalUpdate);
    }

    let channel: any = null;
    if (supabase) {
      try {
        const uniqueId = Math.random().toString(36).substring(7);
        channel = supabase
          .channel(`public:relations:${userId}:${uniqueId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "relations" },
            () => {
              emitRelations();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("Notice Supabase channel relations:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalUpdate);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  },

  /**
   * 7. Écouter les notifications de partenariat en temps réel
   */
  ecouterNotifications(userId: string, callback: (notifs: PartnerNotificationItem[]) => void): () => void {
    if (!userId) return () => {};

    const emitNotifs = async () => {
      const localNotifs = db.getNotifications().filter(n => n.userId === userId);
      const mappedLocal: PartnerNotificationItem[] = localNotifs.map(n => ({
        id: n.id,
        type: "connexion_acceptee",
        lu: n.read || false,
        dateCreation: n.createdAt,
        contenu: n.message || n.title
      }));

      let mappedSb: PartnerNotificationItem[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (!error && data) {
            mappedSb = data.map((n: any) => ({
              id: n.id,
              type: "connexion_acceptee",
              lu: n.read || false,
              dateCreation: n.created_at || new Date().toISOString(),
              contenu: n.message || n.title
            }));
          }
        } catch (e) {
          console.warn("Notice Supabase fetch notifs:", e);
        }
      }

      const map = new Map<string, PartnerNotificationItem>();
      mappedLocal.forEach(n => map.set(n.id, n));
      mappedSb.forEach(n => {
        if (!map.has(n.id)) map.set(n.id, n);
      });

      callback(Array.from(map.values()));
    };

    emitNotifs();

    const handleLocalNotifsUpdate = () => {
      emitNotifs();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_notifications_updated", handleLocalNotifsUpdate);
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
        window.removeEventListener("wakat_notifications_updated", handleLocalNotifsUpdate);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  },

  async marquerNotificationLue(userId: string, notifId: string): Promise<void> {
    const notifs = db.getNotifications().map(n => n.id === notifId ? { ...n, read: true } : n);
    db.saveNotifications(notifs);

    if (supabase) {
      try {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", notifId)
          .eq("user_id", userId);
      } catch (e) {
        console.warn("Notice Supabase read notif:", e);
      }
    }
  },

  async marquerNotificationCommeLue(userId: string, notifId: string): Promise<void> {
    return this.marquerNotificationLue(userId, notifId);
  },

  subscribeToUserNotifications(userId: string, callback: (notifs: PartnerNotificationItem[]) => void): () => void {
    return this.ecouterNotifications(userId, callback);
  }
};
