import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { Connection, Notification, UserProfile } from "../types";
import { db as localDb } from "../data";

export const connectionService = {
  /**
   * Send a connection request to another actor
   */
  async createConnectionRequest(sender: UserProfile, receiver: UserProfile, notes?: string, initialStatus: Connection["status"] = "en_attente"): Promise<Connection> {
    console.log(`[ConnectionService] createConnectionRequest: from=${sender.id} (${sender.role}) to=${receiver.id} (${receiver.role}) with status=${initialStatus}`);
    const connectionId = [sender.id, receiver.id].sort().join('_');
    const connectionRef = doc(db, "connections", connectionId);

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log(`[ConnectionService] Connection ID: ${connectionId}`);

    // Save to Firestore (attempt)
    try {
      console.log(`[ConnectionService] Saving connection doc: connections/${connectionId}`);
      await setDoc(connectionRef, newConnection);
      console.log("[ConnectionService] Connection doc saved to Firestore.");
    } catch (e) {
      console.error("[ConnectionService] Firestore error on connection request:", e);
      // Only throw if it's a permission error or similar fatal error
      if (e instanceof Error && (e.message.includes("permission") || e.message.includes("auth"))) {
        throw e;
      }
    }

    // Always update local storage for offline-first resilience
    const localConns = localDb.getConnections();
    const filteredConns = localConns.filter(c => c.id !== connectionId);
    localDb.saveConnections([newConnection, ...filteredConns]);
    console.log("[ConnectionService] Local storage updated.");

    // Only create a notification for the receiver if it's an 'en_attente' request
    if (initialStatus === "en_attente") {
      console.log(`[ConnectionService] Creating notification for receiver: ${receiver.id}`);
      await this.createNotification(
        receiver.id,
        sender.id,
        "Demande de connexion",
        `${sender.companyName || sender.name} (${sender.role}) souhaite vous ajouter à son carnet d'adresses.`,
        "CONNECTION_REQUEST",
        connectionId
      );
    } else if (initialStatus === "active") {
      // Notify them they've been added
      console.log(`[ConnectionService] Creating notification for receiver: ${receiver.id} (Direct Add)`);
      await this.createNotification(
        receiver.id,
        sender.id,
        "Nouveau partenaire",
        `${sender.companyName || sender.name} (${sender.role}) vous a ajouté à ses partenaires.`,
        "CONNECTION_ACCEPTED",
        connectionId
      );
      
      // Auto-create chat conversation
      try {
        const { chatService } = await import("./chatService");
        await chatService.getOrCreatePrivateConversation(sender.id, receiver.id);
      } catch (err) {
        console.error("Error auto-creating chat:", err);
      }
    }
    
    return newConnection;
  },

  /**
   * Accept or refuse a connection request
   */
  async respondToConnectionRequest(connection: Connection, status: "active" | "refusée"): Promise<void> {
    console.log(`[ConnectionService] respondToConnectionRequest: id=${connection.id}, status=${status}`);
    const connectionRef = doc(db, "connections", connection.id);
    const updatedConnection: Connection = {
      ...connection,
      status,
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore (attempt)
    try {
      console.log(`[ConnectionService] Updating connection doc: connections/${connection.id}`);
      await setDoc(connectionRef, updatedConnection, { merge: true });
      console.log("[ConnectionService] Connection updated in Firestore.");
    } catch (e) {
      console.warn("Firestore error on respondToConnectionRequest, using offline fallback:", e);
    }

    // Always update local storage
    const localConns = localDb.getConnections();
    const updatedConns = localConns.map(c => c.id === connection.id ? updatedConnection : c);
    localDb.saveConnections(updatedConns);
    console.log("[ConnectionService] Local storage updated.");

    // Notify the sender about the response
    const title = status === "active" ? "Connexion acceptée" : "Connexion refusée";
    const message = status === "active" 
      ? `${connection.receiverName} a accepté votre demande de connexion. Vous pouvez désormais lui envoyer des messages.`
      : `${connection.receiverName} a décliné votre demande de connexion.`;

    console.log(`[ConnectionService] Sending notification to original sender: ${connection.senderId}`);
    await this.createNotification(
      connection.senderId,
      connection.receiverId, // Receiver becomes sender of the response notification
      title,
      message,
      status === "active" ? "CONNECTION_ACCEPTED" : "CONNECTION_REJECTED",
      connection.id
    );

    // If accepted, create a chat conversation automatically
    if (status === "active") {
      try {
        const { chatService } = await import("./chatService");
        console.log(`[ConnectionService] Auto-creating conversation for users: ${connection.senderId} and ${connection.receiverId}`);
        await chatService.getOrCreatePrivateConversation(connection.senderId, connection.receiverId);
      } catch (chatErr) {
        console.error("[ConnectionService] Error creating chat conversation after acceptance:", chatErr);
      }
    }
    console.log("[ConnectionService] Response notification triggered.");
  },

  /**
   * Helper to create a notification
   */
  async createNotification(
    userId: string, 
    senderId: string,
    title: string, 
    message: string, 
    type: Notification["type"], 
    relatedId?: string
  ): Promise<Notification> {
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const notificationRef = doc(db, "notifications", notificationId);

    const newNotification: Notification = {
      id: notificationId,
      userId,
      senderId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      relatedId
    };

    // Save to Firestore (attempt)
    try {
      await setDoc(notificationRef, newNotification);
    } catch (e) {
      console.warn("Firestore error on createNotification, using offline fallback:", e);
    }

    // Always update local storage
    const localNotifs = localDb.getNotifications();
    localDb.saveNotifications([newNotification, ...localNotifs]);

    return newNotification;
  },

  /**
   * Subscribe to a user's connections (live stream)
   */
  subscribeToUserConnections(userId: string, callback: (connections: Connection[]) => void) {
    const emitLocal = () => {
      const localConns = localDb.getConnections().filter(c => c.senderId === userId || c.receiverId === userId);
      callback(localConns);
    };

    // Return local data immediately to ensure instant UI response
    emitLocal();

    const handleLocalUpdate = () => {
      emitLocal();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("wakat_connections_updated", handleLocalUpdate);
      window.addEventListener("storage", handleLocalUpdate);
    }

    const q1 = query(collection(db, "connections"), where("senderId", "==", userId));
    const q2 = query(collection(db, "connections"), where("receiverId", "==", userId));

    let senderConns: Connection[] = [];
    let receiverConns: Connection[] = [];

    const handleCallback = () => {
      const merged = [...senderConns, ...receiverConns];
      const uniqueMap = new Map<string, Connection>();
      merged.forEach(c => uniqueMap.set(c.id, c));
      const unique = Array.from(uniqueMap.values()).sort((a, b) => 
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
      
      // Sync local storage with Firestore state
      localDb.saveConnections(unique);
      callback(unique);
    };

    const unsub1 = onSnapshot(q1, (snapshot) => {
      senderConns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Connection));
      handleCallback();
    }, (err) => {
      console.warn("[ConnectionService] Sender query failed, using local fallback", err);
    });

    const unsub2 = onSnapshot(q2, (snapshot) => {
      receiverConns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Connection));
      handleCallback();
    }, (err) => {
      console.warn("[ConnectionService] Receiver query failed, using local fallback", err);
    });

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      unsub1();
      unsub2();
    };
  },

  /**
   * Subscribe to a user's notifications (live stream)
   */
  subscribeToUserNotifications(userId: string, callback: (notifications: Notification[]) => void) {
    const emitLocal = () => {
      const localNotifs = localDb.getNotifications().filter(n => n.userId === userId);
      const sorted = localNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(sorted);
    };

    // Return local data immediately to ensure instant UI response
    emitLocal();

    const handleLocalUpdate = () => {
      emitLocal();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("wakat_notifications_updated", handleLocalUpdate);
      window.addEventListener("storage", handleLocalUpdate);
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      // Sort by date desc
      const sorted = notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      localDb.saveNotifications(sorted);
      callback(sorted);
    }, (err) => {
      console.warn("[ConnectionService] Notifications query failed, using local fallback", err);
    });

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_notifications_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      unsub();
    };
  },

  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const ref = doc(db, "notifications", notificationId);
      await updateDoc(ref, { read: true });
    } catch (e) {
      console.warn("Error marking notification read in Firestore, fallback to local:", e);
    }

    const localNotifs = localDb.getNotifications();
    const updated = localNotifs.map(n => n.id === notificationId ? { ...n, read: true } : n);
    localDb.saveNotifications(updated);
  },

  /**
   * Delete a connection or request
   */
  async deleteConnection(connectionId: string): Promise<void> {
    console.log(`[ConnectionService] deleteConnection: id=${connectionId}`);
    try {
      const connectionRef = doc(db, "connections", connectionId);
      await deleteDoc(connectionRef);
      console.log("[ConnectionService] Connection deleted from Firestore.");
    } catch (e) {
      console.warn("Firestore error on deleteConnection, fallback to local:", e);
    }

    // Always update local storage
    const localConns = localDb.getConnections();
    const filteredConns = localConns.filter(c => c.id !== connectionId);
    localDb.saveConnections(filteredConns);
    console.log("[ConnectionService] Local storage updated.");
  }
};
