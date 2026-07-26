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
  deleteDoc,
  runTransaction,
  serverTimestamp
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
    const relationRef = doc(db, "relations", connectionId);

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

    console.log(`[ConnectionService] Connection ID: ${connectionId}`);

    // Generate notification IDs
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const notifGlobalRef = doc(db, "notifications", notifId);
    const notifSubRef = doc(collection(db, "notifications", receiver.id, "items"), notifId);

    // Save to Firestore using atomic transaction
    try {
      console.log(`[ConnectionService] Starting transaction for createConnectionRequest: ${connectionId}`);
      await runTransaction(db, async (transaction) => {
        // Read existing connection if any
        const connDoc = await transaction.get(connectionRef);
        if (connDoc.exists()) {
          const data = connDoc.data() as Connection;
          if (data.status === "active") {
            throw new Error("Vous êtes déjà en relation active avec ce partenaire.");
          }
          if (data.status === "en_attente") {
            throw new Error("Une demande de connexion est déjà en attente pour ce partenaire.");
          }
        }

        // 1. Set connection document (Legacy and general query reference)
        transaction.set(connectionRef, newConnection, { merge: true });

        // 2. Set relations document (Strict B2B schema)
        transaction.set(relationRef, {
          demandeurId: sender.id,
          destinataireId: receiver.id,
          statut: initialStatus === "active" ? "actif" : "en_attente",
          dateCreation: serverTimestamp(),
          dateReponse: null,
          participants: [sender.id, receiver.id],
          notes: notes || "",
          demandeurNom: sender.companyName || sender.name,
          demandeurRole: sender.role,
          destinataireNom: receiver.companyName || receiver.name,
          destinataireRole: receiver.role
        }, { merge: true });

        // 3. Create notification documents if it is en_attente or active
        if (initialStatus === "en_attente") {
          const content = `${sender.companyName || sender.name} (${sender.role}) souhaite vous ajouter à son carnet d'adresses.`;
          
          // Subcollection notification
          transaction.set(notifSubRef, {
            type: "demande_connexion",
            relationId: connectionId,
            expediteurId: sender.id,
            lu: false,
            dateCreation: serverTimestamp(),
            contenu: content
          });

          // Global notification
          transaction.set(notifGlobalRef, {
            id: notifId,
            userId: receiver.id,
            senderId: sender.id,
            title: "Demande de connexion",
            message: content,
            type: "CONNECTION_REQUEST",
            read: false,
            createdAt: nowIso,
            relatedId: connectionId
          });
        } else if (initialStatus === "active") {
          const content = `${sender.companyName || sender.name} (${sender.role}) vous a ajouté à ses partenaires.`;

          // Subcollection notification
          transaction.set(notifSubRef, {
            type: "connexion_acceptee",
            relationId: connectionId,
            expediteurId: sender.id,
            lu: false,
            dateCreation: serverTimestamp(),
            contenu: content
          });

          // Global notification
          transaction.set(notifGlobalRef, {
            id: notifId,
            userId: receiver.id,
            senderId: sender.id,
            title: "Nouveau partenaire",
            message: content,
            type: "CONNECTION_ACCEPTED",
            read: false,
            createdAt: nowIso,
            relatedId: connectionId
          });
        }
      });
      console.log("[ConnectionService] Atomic transaction for connection request completed successfully.");
    } catch (e: any) {
      console.error("[ConnectionService] Transaction Firestore error on connection request:", e);
      if (e instanceof Error && (e.message.includes("déjà en relation") || e.message.includes("déjà en attente"))) {
        throw e;
      }
      // If it is another error (e.g. network/offline), keep offline fallback
    }

    // Always update local storage for offline-first resilience
    const localConns = localDb.getConnections();
    const filteredConns = localConns.filter(c => c.id !== connectionId);
    localDb.saveConnections([newConnection, ...filteredConns]);
    console.log("[ConnectionService] Local storage updated.");

    // Update local notifications if en_attente or active
    if (initialStatus === "en_attente") {
      const localNotifs = localDb.getNotifications();
      localDb.saveNotifications([{
        id: notifId,
        userId: receiver.id,
        senderId: sender.id,
        title: "Demande de connexion",
        message: `${sender.companyName || sender.name} (${sender.role}) souhaite vous ajouter à son carnet d'adresses.`,
        type: "CONNECTION_REQUEST",
        read: false,
        createdAt: nowIso,
        relatedId: connectionId
      }, ...localNotifs]);
    } else if (initialStatus === "active") {
      const localNotifs = localDb.getNotifications();
      localDb.saveNotifications([{
        id: notifId,
        userId: receiver.id,
        senderId: sender.id,
        title: "Nouveau partenaire",
        message: `${sender.companyName || sender.name} (${sender.role}) vous a ajouté à ses partenaires.`,
        type: "CONNECTION_ACCEPTED",
        read: false,
        createdAt: nowIso,
        relatedId: connectionId
      }, ...localNotifs]);

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
    const relationRef = doc(db, "relations", connection.id);

    const nowIso = new Date().toISOString();
    const updatedConnection: Connection = {
      ...connection,
      status,
      updatedAt: nowIso
    };

    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const notifGlobalRef = doc(db, "notifications", notifId);
    const notifSubRef = doc(collection(db, "notifications", connection.senderId, "items"), notifId);

    const title = status === "active" ? "Connexion acceptée" : "Connexion refusée";
    const message = status === "active" 
      ? `${connection.receiverName} a accepté votre demande de connexion. Vous pouvez désormais lui envoyer des messages.`
      : `${connection.receiverName} a décliné votre demande de connexion.`;

    const typeNotifSub = status === "active" ? "connexion_acceptee" : "connexion_refusee";
    const typeNotifGlobal: Notification["type"] = status === "active" ? "CONNECTION_ACCEPTED" : "CONNECTION_REJECTED";

    try {
      console.log(`[ConnectionService] Starting transaction for respondToConnectionRequest: ${connection.id}`);
      await runTransaction(db, async (transaction) => {
        const connDoc = await transaction.get(connectionRef);
        if (!connDoc.exists()) {
          throw new Error("La connexion spécifiée n'existe pas.");
        }

        // 1. Update connections doc
        transaction.update(connectionRef, {
          status,
          updatedAt: nowIso
        });

        // 2. Update relations doc
        transaction.update(relationRef, {
          statut: status === "active" ? "actif" : "refuse",
          dateReponse: serverTimestamp()
        });

        // 3. Subcollection notification for sender
        transaction.set(notifSubRef, {
          type: typeNotifSub,
          relationId: connection.id,
          expediteurId: connection.receiverId,
          lu: false,
          dateCreation: serverTimestamp(),
          contenu: message
        });

        // 4. Global notification for sender
        transaction.set(notifGlobalRef, {
          id: notifId,
          userId: connection.senderId,
          senderId: connection.receiverId,
          title,
          message,
          type: typeNotifGlobal,
          read: false,
          createdAt: nowIso,
          relatedId: connection.id
        });
      });
      console.log("[ConnectionService] Atomic transaction for respondToConnectionRequest completed successfully.");
    } catch (e) {
      console.warn("Firestore error on respondToConnectionRequest, using offline fallback:", e);
    }

    // Always update local storage
    const localConns = localDb.getConnections();
    const updatedConns = localConns.map(c => c.id === connection.id ? updatedConnection : c);
    localDb.saveConnections(updatedConns);
    console.log("[ConnectionService] Local storage updated.");

    // Update local notifications
    const localNotifs = localDb.getNotifications();
    localDb.saveNotifications([{
      id: notifId,
      userId: connection.senderId,
      senderId: connection.receiverId,
      title,
      message,
      type: typeNotifGlobal,
      read: false,
      createdAt: nowIso,
      relatedId: connection.id
    }, ...localNotifs]);

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
      
      // Sync local storage with Firestore state safely
      const existingLocal = localDb.getConnections();
      const map = new Map<string, Connection>();
      existingLocal.forEach(c => map.set(c.id, c));
      unique.forEach(c => map.set(c.id, c));
      const allConns = Array.from(map.values());
      localDb.saveConnections(allConns);

      const userConns = allConns.filter(c => c.senderId === userId || c.receiverId === userId)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      callback(userConns);
    };

    let unsub1 = () => {};
    let unsub2 = () => {};

    try {
      unsub1 = onSnapshot(q1, (snapshot) => {
        senderConns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Connection));
        handleCallback();
      }, (err) => {
        console.warn("[ConnectionService] Sender query failed, using local fallback", err);
        handleCallback();
      });
    } catch (e) {
      console.warn("[ConnectionService] Failed to set up real-time listener for q1:", e);
    }

    try {
      unsub2 = onSnapshot(q2, (snapshot) => {
        receiverConns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Connection));
        handleCallback();
      }, (err) => {
        console.warn("[ConnectionService] Receiver query failed, using local fallback", err);
        handleCallback();
      });
    } catch (e) {
      console.warn("[ConnectionService] Failed to set up real-time listener for q2:", e);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      try {
        unsub1();
      } catch (e) {
        console.warn("[ConnectionService] Error unsubscribing unsub1:", e);
      }
      try {
        unsub2();
      } catch (e) {
        console.warn("[ConnectionService] Error unsubscribing unsub2:", e);
      }
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

    let unsub = () => {};
    try {
      unsub = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        // Sort by date desc
        const sorted = notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const existingLocal = localDb.getNotifications();
        const map = new Map<string, Notification>();
        existingLocal.forEach(n => map.set(n.id, n));
        sorted.forEach(n => map.set(n.id, n));
        const allNotifs = Array.from(map.values());
        localDb.saveNotifications(allNotifs);

        const userNotifs = allNotifs.filter(n => n.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(userNotifs);
      }, (err) => {
        console.warn("[ConnectionService] Notifications query failed, using local fallback", err);
        emitLocal();
      });
    } catch (e) {
      console.warn("[ConnectionService] Failed to set up real-time listener for notifications:", e);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_notifications_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      try {
        unsub();
      } catch (e) {
        console.warn("[ConnectionService] Error unsubscribing from notifications:", e);
      }
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
