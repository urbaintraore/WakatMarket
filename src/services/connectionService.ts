import { Connection, Notification, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";

export const connectionService = {
  /**
   * Créer une demande ou relation de connexion d'affaires dans la table 'relations'
   */
  async createConnectionRequest(
    sender: UserProfile,
    receiver: UserProfile,
    notes?: string,
    initialStatus: Connection["status"] = "en_attente"
  ): Promise<Connection> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    const connectionId = [sender.id, receiver.id].sort().join("_");
    const nowIso = new Date().toISOString();

    const newConnection: Connection = {
      id: connectionId,
      senderId: sender.id,
      receiverId: receiver.id,
      status: initialStatus,
      senderName: sender.companyName || sender.name,
      senderRole: sender.role,
      receiverName: receiver.companyName || receiver.name,
      receiverRole: receiver.role,
      notes,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 1. Sauvegarder dans 'relations' (grossiste_id, client_id, statut)
    const { error: relError } = await supabase.from("relations").upsert({
      id: connectionId,
      grossiste_id: sender.id,
      client_id: receiver.id,
      statut: initialStatus === "active" ? "ACTIF" : "PENDING"
    });

    if (relError) {
      console.error("[Supabase Connection Sync Error]:", relError);
      throw relError;
    }

    // 2. Créer une notification pour le destinataire
    if (initialStatus === "en_attente") {
      try {
        await supabase.from("notifications").insert({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          user_id: receiver.id,
          title: "Demande de connexion d'affaires",
          read: false,
          message: `${sender.companyName || sender.name} (${sender.role}) souhaite vous ajouter comme partenaire d'affaires.`
        });
      } catch (notifErr) {
        console.warn("Notice notification creation:", notifErr);
      }
    }

    return newConnection;
  },

  /**
   * Accepter une demande de connexion
   */
  async acceptConnection(connectionId: string, _currentUserId?: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from("relations")
      .update({ statut: "ACTIF" })
      .eq("id", connectionId);

    if (error) {
      console.error("Erreur acceptation connexion Supabase:", error);
      throw error;
    }
  },

  /**
   * Rejeter une demande de connexion
   */
  async rejectConnection(connectionId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from("relations")
      .update({ statut: "BLOCKED" })
      .eq("id", connectionId);

    if (error) {
      console.error("Erreur rejet connexion Supabase:", error);
      throw error;
    }
  },

  /**
   * Répondre à une demande de connexion (accepter ou refuser)
   */
  async respondToConnectionRequest(
    connectionOrId: string | any,
    action: string,
    currentUserId?: string
  ): Promise<void> {
    const connectionId = typeof connectionOrId === "string" ? connectionOrId : connectionOrId?.id;
    const act = String(action).toLowerCase();
    const isAccept = act.includes("acc") || act === "active" || act === "actif";
    if (isAccept) {
      await this.acceptConnection(connectionId, currentUserId);
    } else {
      await this.rejectConnection(connectionId);
    }
  },

  /**
   * Supprimer une connexion
   */
  async deleteConnection(connectionId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("relations")
      .delete()
      .eq("id", connectionId);

    if (error) {
      console.error("Erreur suppression connexion Supabase:", error);
      throw error;
    }
  },

  /**
   * S'abonner aux connexions d'un utilisateur
   */
  subscribeToUserConnections(userId: string, callback: (connections: Connection[]) => void): () => void {
    if (!supabase || !userId) return () => {};

    const fetchConnections = async () => {
      const { data, error } = await supabase
        .from("relations")
        .select("*")
        .or(`grossiste_id.eq.${userId},client_id.eq.${userId}`);

      if (error) {
        console.warn("Erreur fetch connections Supabase:", error.message);
        return;
      }

      const list: Connection[] = (data || []).map((row: any) => ({
        id: row.id,
        senderId: row.grossiste_id,
        receiverId: row.client_id,
        status: (row.statut === "ACTIF" ? "active" : row.statut === "BLOCKED" ? "bloque" : "en_attente") as any,
        senderName: "Partenaire",
        senderRole: UserRole.WHOLESALER,
        receiverName: "Partenaire",
        receiverRole: UserRole.RETAILER,
        notes: "",
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.created_at || new Date().toISOString()
      }));

      callback(list);
    };

    fetchConnections();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:relations_conn:${userId}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relations" },
        () => {
          fetchConnections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * S'abonner aux notifications d'un utilisateur
   */
  subscribeToUserNotifications(userId: string, callback: (notifications: any[]) => void): () => void {
    if (!supabase || !userId) return () => {};

    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Erreur fetch notifications Supabase:", error.message);
        return;
      }

      const list = (data || []).map((row: any) => ({
        id: row.id,
        type: "general",
        contenu: row.message || row.title,
        message: row.message || row.title,
        title: row.title || row.message,
        lu: Boolean(row.read),
        read: Boolean(row.read),
        dateCreation: row.created_at || new Date().toISOString(),
        timestamp: row.created_at || new Date().toISOString(),
      }));

      callback(list);
    };

    fetchNotifs();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:notifications:${userId}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          fetchNotifs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Marquer une notification comme lue
   */
  async markNotificationAsRead(arg1: string, arg2?: string): Promise<void> {
    if (!supabase) return;
    const notifId = arg2 || arg1;
    if (!notifId) return;
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", notifId);
    } catch (e) {
      console.warn("Notice mark notification read:", e);
    }
  }
};

