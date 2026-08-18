import { Connection, Notification, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";

export const connectionService = {
  /**
   * Créer une demande ou relation de connexion d'affaires
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

    // 1. Sauvegarder dans 'business_relationships'
    const { error: relError } = await supabase.from("business_relationships").upsert({
      id: connectionId,
      supplier_id: sender.id,
      buyer_id: receiver.id,
      status: initialStatus === "active" ? "ACTIVE" : "PENDING",
      payment_terms: notes || null,
      updated_at: nowIso
    });

    if (relError) {
      console.error("Erreur enregistrement connexion Supabase:", relError);
      throw relError;
    }

    // 2. Créer une notification pour le destinataire
    if (initialStatus === "en_attente") {
      await supabase.from("notifications").insert({
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        user_id: receiver.id,
        title: "Demande de connexion d'affaires",
        type: "demande_connexion",
        read: false,
        metadata: { relationId: connectionId, senderId: sender.id },
        message: `${sender.companyName || sender.name} (${sender.role}) souhaite vous ajouter comme partenaire d'affaires.`
      });
    }

    return newConnection;
  },

  /**
   * Accepter une demande de connexion
   */
  async acceptConnection(connectionId: string, _currentUserId?: string): Promise<void> {
    if (!supabase) return;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("business_relationships")
      .update({ status: "ACTIVE", updated_at: nowIso })
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
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("business_relationships")
      .update({ status: "BLOCKED", updated_at: nowIso })
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
      .from("business_relationships")
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
        .from("business_relationships")
        .select("*")
        .or(`supplier_id.eq.${userId},buyer_id.eq.${userId}`);

      if (error) {
        console.error("Erreur fetch connections Supabase:", error);
        return;
      }

      const list: Connection[] = (data || []).map((row: any) => ({
        id: row.id,
        senderId: row.supplier_id,
        receiverId: row.buyer_id,
        status: (row.status === "ACTIVE" ? "active" : row.status === "BLOCKED" ? "bloque" : "en_attente") as any,
        senderName: "Fournisseur",
        senderRole: UserRole.WHOLESALER,
        receiverName: "Client",
        receiverRole: UserRole.RETAILER,
        notes: row.payment_terms || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      callback(list);
    };

    fetchConnections();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:connections:${userId}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_relationships" },
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
        console.error("Erreur fetch notifications Supabase:", error);
        return;
      }

      const list = (data || []).map((row: any) => ({
        id: row.id,
        relationId: row.metadata?.relationId,
        orderId: row.metadata?.orderId || row.metadata?.venteId,
        type: row.type || "general",
        contenu: row.message,
        message: row.message,
        title: row.title,
        lu: Boolean(row.read),
        read: Boolean(row.read),
        dateCreation: row.created_at,
        timestamp: row.created_at,
        metadata: row.metadata || {}
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
