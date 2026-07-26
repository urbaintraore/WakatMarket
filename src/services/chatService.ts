import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  getDoc,
  serverTimestamp,
  limit,
  Timestamp,
  increment
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase/firebase";
import { supabase } from "../supabase";
import { Conversation, ChatMessage, MessageType, MessageStatus } from "../types";
import { db as localDb } from "../data";

export const chatService = {
  /**
   * Initializes a new conversation or returns an existing private conversation between two users
   */
  async getOrCreatePrivateConversation(currentUserId: string, otherUserId: string, context?: any): Promise<string> {
    try {
      const convId = [currentUserId, otherUserId].sort().join('_');
      const convRef = doc(db, "conversations", convId);
      
      const newConv: Partial<Conversation> = {
        id: convId,
        type: "PRIVATE",
        participants: [currentUserId, otherUserId],
        participantDetails: {
          [currentUserId]: { userId: currentUserId, joinedAt: new Date().toISOString(), role: "ADMIN" },
          [otherUserId]: { userId: otherUserId, joinedAt: new Date().toISOString(), role: "ADMIN" }
        },
        unreadCount: {
          [currentUserId]: 0,
          [otherUserId]: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...context
      };

      try {
        const convSnap = await getDoc(convRef);
        if (!convSnap.exists()) {
          await setDoc(convRef, newConv);
        }
      } catch (e) {
        console.warn("[chatService] Firestore getOrCreatePrivateConversation failed, utilizing offline/local mode", e);
        try {
          await setDoc(convRef, newConv, { merge: true });
        } catch (innerErr) {
          console.warn("[chatService] Inner setDoc failed as well, continuing offline-only:", innerErr);
        }
      }
      
      return convId;
    } catch (error) {
      console.error("Error in getOrCreatePrivateConversation:", error);
      // Return the generated ID anyway so the UI can proceed optimistically
      return [currentUserId, otherUserId].sort().join('_');
    }
  },

  async createGroupConversation(creatorId: string, name: string, participantIds: string[], description?: string, image?: string): Promise<string> {
    try {
      const convRef = doc(collection(db, "conversations"));
      
      const participantDetails: Record<string, any> = {};
      participantIds.forEach(id => {
        participantDetails[id] = {
          userId: id,
          joinedAt: new Date().toISOString(),
          role: id === creatorId ? "ADMIN" : "MEMBER"
        };
      });

      const unreadCount: Record<string, number> = {};
      participantIds.forEach(id => {
        unreadCount[id] = 0;
      });

      const newConv: Partial<Conversation> = {
        id: convRef.id,
        type: "GROUP",
        groupName: name,
        groupDescription: description,
        groupImage: image,
        createdBy: creatorId,
        participants: participantIds,
        participantDetails,
        unreadCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(convRef, newConv);
      return convRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "conversations");
    }
  },

  /**
   * Listens to all conversations for a user
   */
  subscribeToUserConversations(userId: string, callback: (convs: Conversation[]) => void) {
    const emitLocal = () => {
      const activeConns = localDb.getConnections()
        .filter(c => c.status === "active" && (c.senderId === userId || c.receiverId === userId));
      
      const fallbackConvs: Conversation[] = activeConns.map(conn => {
        const otherId = conn.senderId === userId ? conn.receiverId : conn.senderId;
        
        // Find if there is a last message in local messages
        const msgs = localDb.getMessages()
          .filter(m => m.conversationId === conn.id)
          .sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
        const lastMsg = msgs[msgs.length - 1];

        return {
          id: conn.id,
          type: "PRIVATE",
          participants: [conn.senderId, conn.receiverId],
          participantDetails: {
            [conn.senderId]: { userId: conn.senderId, joinedAt: conn.createdAt, role: "ADMIN" },
            [conn.receiverId]: { userId: conn.receiverId, joinedAt: conn.createdAt, role: "ADMIN" }
          },
          lastMessage: lastMsg?.content || "Aucun message",
          lastMessageDate: lastMsg?.createdAt || conn.updatedAt || conn.createdAt,
          unreadCount: {
            [userId]: 0,
            [otherId]: 0
          },
          createdAt: conn.createdAt,
          updatedAt: lastMsg?.createdAt || conn.updatedAt || conn.createdAt
        };
      });

      callback(fallbackConvs);
    };

    emitLocal();

    const handleLocalUpdate = () => {
      emitLocal();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("wakat_connections_updated", handleLocalUpdate);
      window.addEventListener("wakat_messages_updated", handleLocalUpdate);
      window.addEventListener("storage", handleLocalUpdate);
    }

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => doc.data() as Conversation);
      
      // If we got real data, merge with any local info
      if (convs.length > 0) {
        callback(convs);
      } else {
        emitLocal();
      }
    }, (error) => {
      console.warn("[chatService] Conversations query failed, relying on dynamic local fallback", error);
    });

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalUpdate);
        window.removeEventListener("wakat_messages_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      unsub();
    };
  },

  /**
   * Listens to messages in a conversation with reliable local caching & real-time synchronization
   */
  subscribeToMessages(convId: string, callback: (msgs: ChatMessage[]) => void) {
    const emitLocal = () => {
      const localMsgs = localDb.getMessages()
        .filter(m => m.conversationId === convId)
        .sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
      callback(localMsgs);
    };

    // Return cached local messages immediately for instant response
    emitLocal();

    const handleLocalUpdate = () => {
      emitLocal();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("wakat_messages_updated", handleLocalUpdate);
      window.addEventListener("storage", handleLocalUpdate);
    }

    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const firestoreMsgs = snapshot.docs.map(doc => doc.data() as ChatMessage);
      
      // Merge with existing local messages
      const existingLocal = localDb.getMessages();
      
      // Replace or insert Firestore messages into local array by matching id
      const map = new Map<string, ChatMessage>();
      existingLocal.forEach(m => map.set(m.id, m));
      firestoreMsgs.forEach(m => map.set(m.id, m));
      
      const allMsgs = Array.from(map.values());
      localDb.saveMessages(allMsgs);
      
      // Filter current conversation's messages and pass to callback
      const currentMsgs = allMsgs
        .filter(m => m.conversationId === convId)
        .sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
        
      callback(currentMsgs);
    }, (error) => {
      console.warn("[chatService] Real-time message listener failed, using local cache:", error);
    });

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_messages_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      unsub();
    };
  },

  /**
   * Send a message with instant local persistence and Firestore replication
   */
  async sendMessage(
    convId: string, 
    senderId: string, 
    type: MessageType, 
    content: string, 
    extra?: Partial<ChatMessage>,
    participantsToNotify?: string[]
  ): Promise<void> {
    console.log(`[chatService.sendMessage] Creating message for convId=${convId}, type=${type}`);
    
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const nowIso = new Date().toISOString();
    
    const newMsg: ChatMessage = {
      id: msgId,
      conversationId: convId,
      senderId,
      type,
      content,
      status: MessageStatus.SENT,
      createdAt: nowIso,
      readBy: {
        [senderId]: nowIso
      },
      ...extra
    };

    // 1. Immediately save to localDb for instant offline responsiveness
    const existingLocal = localDb.getMessages();
    localDb.saveMessages([...existingLocal, newMsg]);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wakat_messages_updated"));
    }

    try {
      const msgRef = doc(db, "conversations", convId, "messages", msgId);
      console.log(`[chatService.sendMessage] Writing to Firestore messages subcollection... Message ID=${msgId}`);
      
      // Save to Firestore
      await setDoc(msgRef, newMsg);
      console.log(`[chatService.sendMessage] Message written successfully.`);

      // Update the conversation's last message and unread counts
      const convRef = doc(db, "conversations", convId);
      
      const updates: any = {
        lastMessage: type === MessageType.TEXT ? content : `[${type}]`,
        lastMessageDate: nowIso,
        updatedAt: nowIso
      };

      if (participantsToNotify) {
        participantsToNotify.forEach(p => {
          if (p !== senderId) {
            updates[`unreadCount.${p}`] = increment(1);
          }
        });
      }

      console.log(`[chatService.sendMessage] Updating conversation document (convId=${convId}) with lastMessage info...`);
      await setDoc(convRef, updates, { merge: true });
      console.log(`[chatService.sendMessage] Conversation document updated successfully.`);
    } catch (error: any) {
      console.warn("[chatService.sendMessage] Failed to send message to Firestore (using offline mode):", error);
      // Don't throw so that offline user experience remains uninterrupted
    }
  },

  async markConversationAsRead(convId: string, userId: string): Promise<void> {
    try {
      const convRef = doc(db, "conversations", convId);
      await setDoc(convRef, {
        [`unreadCount.${userId}`]: 0
      }, { merge: true });

      // Optionally, we could find all unread messages and mark them as read by this user.
      // But for performance, unreadCount is usually sufficient for the UI.
    } catch (error) {
      console.warn("[chatService] markConversationAsRead failed in Firestore, ignoring for offline resilience", error);
    }
  },

  /**
   * Upload media file (Image, Video, Document, Voice note)
   */
  async uploadMedia(file: File | Blob, folder: string, filename: string): Promise<string> {
    console.log(`[chatService.uploadMedia] Start upload to folder=${folder}, filename=${filename}, type=${file.type}, size=${file.size}`);
    try {
      if (!supabase) {
        throw new Error("Supabase is not configured (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing).");
      }

      const filePath = `${folder}/${filename}`;
      console.log(`[chatService.uploadMedia] Uploading to Supabase Storage: ${filePath}`);
      
      const { data, error } = await supabase.storage
        .from('chat')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (error) {
        console.error("[chatService.uploadMedia] Supabase Storage upload error:", error);
        throw error;
      }
      
      console.log(`[chatService.uploadMedia] upload successful. Getting public URL...`);
      const { data: publicUrlData } = supabase.storage
        .from('chat')
        .getPublicUrl(filePath);
        
      const url = publicUrlData.publicUrl;
      console.log(`[chatService.uploadMedia] Public URL generated: ${url.substring(0, 50)}...`);
      return url;
    } catch (error: any) {
      console.error("[chatService.uploadMedia] Storage upload error:", error);
      console.error("[chatService.uploadMedia] Error details:", JSON.stringify(error));
      throw error;
    }
  },

  async saveTranscription(convId: string, msgId: string, transcription: string): Promise<void> {
    try {
      const msgRef = doc(db, "conversations", convId, "messages", msgId);
      await setDoc(msgRef, { transcription }, { merge: true });
    } catch (error) {
      console.error("Error saving transcription:", error);
    }
  }
};
