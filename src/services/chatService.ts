import { Conversation, ChatMessage, MessageType, MessageStatus } from "../types";
import { isFirebaseConfigured, firestoreUpsert, firestoreUpdate, firestoreSubscribe, firestoreSubscribeWhere } from "../firebase";
import { uploadToCloudflare } from "../cloudflare";
import { db } from "../data";

import { connectionService, ensureUsersExistLocally } from "./connectionService";

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.text || row.content || "",
    text: row.text || row.content || "",
    type: row.type ? (row.type as MessageType) : MessageType.TEXT,
    status: row.status ? (row.status as MessageStatus) : MessageStatus.DELIVERED,
    timestamp: row.created_at || new Date().toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
    mediaUrl: row.media_url || row.mediaUrl,
    audioUrl: row.audio_url || row.audioUrl,
    transcription: row.transcription
  };
}

export const chatService = {
  /**
   * Récupérer ou créer une conversation privée avec validation du schéma participants
   */
  async getOrCreatePrivateConversation(currentUserId: string, otherUserId: string, _context?: any): Promise<string> {
    const convId = [currentUserId, otherUserId].sort().join("_");
    if (!isFirebaseConfigured()) return convId;

    try {
      const participantsArray = [currentUserId, otherUserId];
      await firestoreUpsert("conversations", {
        id: convId,
        participants: participantsArray,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Notice conversation creation Firestore:", e);
    }

    return convId;
  },

  /**
   * Créer une conversation de groupe
   */
  async createGroupConversation(
    creatorId: string,
    name: string,
    participantIds: string[],
    _description?: string,
    _image?: string
  ): Promise<string> {
    const convId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const allParticipants = Array.from(new Set([creatorId, ...participantIds]));

    if (isFirebaseConfigured()) {
      try {
        await firestoreUpsert("conversations", {
          id: convId,
          participants: allParticipants,
          last_message: `Groupe ${name} créé`,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Notice group conversation Firestore:", e);
      }
    }

    return convId;
  },

  /**
   * Envoyer un message dans une conversation avec fallback local garanti et schéma Firestore nettoyé
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    typeOrContent: MessageType | string,
    contentOrType: string | MessageType = "",
    _metadata?: Record<string, any>,
    _receiverOrParticipants?: string | string[]
  ): Promise<string> {
    let finalContent = "";

    const allTypes = Object.values(MessageType) as string[];
    let messageType: MessageType = MessageType.TEXT;

    if (allTypes.includes(typeOrContent as string)) {
      messageType = typeOrContent as MessageType;
      finalContent = typeof contentOrType === "string" ? contentOrType : String(contentOrType || "");
    } else if (allTypes.includes(contentOrType as string)) {
      messageType = contentOrType as MessageType;
      finalContent = String(typeOrContent || "");
    } else {
      finalContent = String(typeOrContent || "");
    }

    let receiverId: string | undefined = undefined;
    if (_receiverOrParticipants) {
      receiverId = Array.isArray(_receiverOrParticipants)
        ? _receiverOrParticipants.find(id => id !== senderId)
        : _receiverOrParticipants;
    }
    
    if (!receiverId && conversationId && !conversationId.startsWith("grp_")) {
      const parts = conversationId.split("_");
      if (parts.length === 2) {
        receiverId = parts.find(id => id !== senderId);
      }
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const senderUser = db.getUsers().find(u => u.id === senderId);

    const freshMsg: ChatMessage = {
      id: messageId,
      conversationId,
      senderId,
      senderName: senderUser?.companyName || senderUser?.name || "Expéditeur",
      senderRole: senderUser?.role,
      content: finalContent,
      text: finalContent,
      type: messageType,
      status: MessageStatus.DELIVERED,
      timestamp: nowIso,
      createdAt: nowIso,
      mediaUrl: _metadata?.mediaUrl,
      audioUrl: _metadata?.audioUrl,
      latitude: _metadata?.latitude,
      longitude: _metadata?.longitude,
      transcription: _metadata?.transcription
    };

    // 1. Sauvegarder immédiatement dans le store local (localStorage + Event)
    const currentMsgs = db.getMessages();
    db.saveMessages([...currentMsgs, freshMsg]);

    // 2. Synchroniser vers Firestore avec un payload strict sans champs obsolètes
    if (isFirebaseConfigured()) {
      try {
        const record: Record<string, any> = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: senderId,
          text: finalContent,
          created_at: nowIso
        };

        if (_metadata?.mediaUrl) record.media_url = _metadata.mediaUrl;
        if (_metadata?.audioUrl) record.audio_url = _metadata.audioUrl;
        if (_metadata?.transcription) record.transcription = _metadata.transcription;

        await firestoreUpsert("messages", record);

        try {
          await firestoreUpdate("conversations", conversationId, {
            last_message: finalContent,
            updated_at: nowIso
          });
        } catch (convErr: any) {
          console.warn("Notice update conversation Firestore:", convErr.message);
        }
      } catch (e: any) {
        console.warn("Notice Firestore sendMessage error:", e.message || e);
      }
    }

    return messageId;
  },

  /**
   * Téléverser un fichier média pour le chat vers Cloudflare R2 (dossier Chat)
   */
  async uploadChatMedia(conversationId: string, file: File | Blob, mimeType?: string): Promise<string> {
    if (!isFirebaseConfigured()) {
      throw new Error("Cloudflare R2 / Firebase n'est pas configuré.");
    }

    const timestamp = Date.now();
    const ext = file instanceof File && file.name ? file.name.split(".").pop() : "bin";
    const storagePath = `chat-media/${conversationId}/${timestamp}.${ext}`;
    const folder = "Chat";

    const publicUrl = await uploadToCloudflare(folder, storagePath, file, mimeType || (file as any).type || "application/octet-stream");
    if (!publicUrl) {
      throw new Error("Échec upload média chat vers Cloudflare R2.");
    }

    return publicUrl;
  },

  /**
   * Alias uploadMedia
   */
  async uploadMedia(file: File | Blob, conversationId: string, mimeType?: string): Promise<string> {
    return this.uploadChatMedia(conversationId, file, mimeType);
  },

  /**
   * S'abonner aux messages d'une conversation en temps réel
   */
  subscribeToMessages(conversationId: string, callback: (messages: ChatMessage[]) => void): () => void {
    if (!conversationId) return () => {};

    const emitMessages = (remoteRows?: any[]) => {
      const localMsgs = db.getMessages().filter(m => m.conversationId === conversationId);

      const map = new Map<string, ChatMessage>();
      localMsgs.forEach(m => map.set(m.id, m));

      if (remoteRows && remoteRows.length > 0) {
        remoteRows.forEach(row => {
          const m = rowToMessage(row);
          if (!map.has(m.id)) map.set(m.id, m);
        });
      }

      const sorted = Array.from(map.values()).sort(
        (a, b) => new Date(a.timestamp || a.createdAt || 0).getTime() - new Date(b.timestamp || b.createdAt || 0).getTime()
      );

      callback(sorted);
    };

    const handleLocalMsgChange = () => {
      emitMessages();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_messages_updated", handleLocalMsgChange);
    }

    let unsubscribeRemote: (() => void) | null = null;
    if (isFirebaseConfigured()) {
      try {
        unsubscribeRemote = firestoreSubscribeWhere("messages", "conversation_id", "==", conversationId, (rows) => {
          emitMessages(rows);
        });
      } catch (e) {
        console.warn("Notice abonnement messages Firestore:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_messages_updated", handleLocalMsgChange);
      }
      if (unsubscribeRemote) unsubscribeRemote();
    };
  },

  /**
   * S'abonner aux conversations d'un utilisateur
   */
  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    if (!userId) return () => {};

    const emitConvs = (remoteRows?: any[]) => {
      let remoteConvs: Conversation[] = [];
      if (remoteRows && remoteRows.length > 0) {
        remoteConvs = remoteRows
          .map((row: any): Conversation | null => {
            let parsedParts: string[] = [];
            if (Array.isArray(row.participants)) {
              parsedParts = row.participants;
            } else if (typeof row.participants === "string") {
              try {
                parsedParts = JSON.parse(row.participants);
              } catch {
                parsedParts = row.participants.split(",").map((s: string) => s.trim().replace(/^["'\[]+|["'\]]+$/g, "")).filter(Boolean);
              }
            }
            if (!parsedParts.includes(userId)) return null;
            if (!parsedParts.length) return null;

            return {
              id: row.id,
              type: "PRIVATE",
              participants: parsedParts,
              groupName: "Discussion",
              participantDetails: {},
              unreadCount: {},
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString()
            };
          })
          .filter((c: Conversation | null): c is Conversation => !!c);

        const allParticipantIds = remoteConvs.flatMap(c => c.participants).filter(Boolean);
        ensureUsersExistLocally(allParticipantIds);
      }

      // Reconstruire aussi à partir des relations locales
      const localConns = db.getConnections().filter(c => c.senderId === userId || c.receiverId === userId);
      const localConvs: Conversation[] = localConns.map(c => ({
        id: c.id,
        type: "PRIVATE",
        participants: [c.senderId, c.receiverId],
        groupName: c.senderId === userId ? c.receiverName : c.senderName,
        participantDetails: {},
        unreadCount: {},
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));

      const map = new Map<string, Conversation>();
      localConvs.forEach(c => map.set(c.id, c));
      remoteConvs.forEach(c => {
        if (!map.has(c.id)) map.set(c.id, c);
      });

      callback(Array.from(map.values()));
    };

    emitConvs();

    const handleLocalConnChange = () => {
      emitConvs();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_connections_updated", handleLocalConnChange);
    }

    let unsubscribeRemote: (() => void) | null = null;
    if (isFirebaseConfigured()) {
      try {
        unsubscribeRemote = firestoreSubscribe("conversations", (rows) => {
          emitConvs(rows);
        });
      } catch (e) {
        console.warn("Notice abonnement conversations Firestore:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalConnChange);
      }
      if (unsubscribeRemote) unsubscribeRemote();
    };
  },

  /**
   * Alias subscribeToUserConversations
   */
  subscribeToUserConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    return this.subscribeToConversations(userId, callback);
  },

  /**
   * Marquer une conversation comme lue
   */
  async markConversationAsRead(_conversationId: string, _userId: string): Promise<void> {
    return;
  },

  /**
   * Sauvegarder une transcription audio
   */
  async saveTranscription(messageId: string, transcription: string, _conversationId?: string): Promise<void> {
    const msgs = db.getMessages();
    const updated = msgs.map(m => m.id === messageId ? { ...m, content: transcription, transcription } : m);
    db.saveMessages(updated);

    if (isFirebaseConfigured() && messageId) {
      try {
        await firestoreUpdate("messages", messageId, { text: transcription, transcription });
      } catch (e) {
        console.warn("Notice save transcription:", e);
      }
    }
  }
};