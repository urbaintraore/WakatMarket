import { Conversation, ChatMessage, MessageType, MessageStatus } from "../types";
import { supabase, uploadToSupabaseStorage } from "../supabase";
import { db } from "../data";

import { connectionService, ensureUsersExistLocally } from "./connectionService";

export const chatService = {
  /**
   * Récupérer ou créer une conversation privée avec validation du schéma participants
   */
  async getOrCreatePrivateConversation(currentUserId: string, otherUserId: string, _context?: any): Promise<string> {
    const convId = [currentUserId, otherUserId].sort().join("_");
    if (!supabase) return convId;

    try {
      const participantsArray = [currentUserId, otherUserId];
      console.log(`[ChatService] Upserting conversation ${convId} with participants array:`, participantsArray);

      await supabase.from("conversations").upsert({
        id: convId,
        participants: participantsArray,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Notice conversation creation Supabase:", e);
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

    if (supabase) {
      try {
        console.log(`[ChatService] Creating group conversation ${convId} with participants:`, allParticipants);
        await supabase.from("conversations").insert({
          id: convId,
          participants: allParticipants,
          last_message: `Groupe ${name} créé`,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Notice group conversation Supabase:", e);
      }
    }

    return convId;
  },

  /**
   * Envoyer un message dans une conversation avec fallback local garanti et schéma Supabase nettoyé
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

    // Inspection de statut de relation avant la transmission de message
    let receiverId: string | undefined = undefined;
    if (_receiverOrParticipants) {
      receiverId = Array.isArray(_receiverOrParticipants)
        ? _receiverOrParticipants.find(id => id !== senderId)
        : _receiverOrParticipants;
    }
    
    // Fallback: extract receiver from conversationId if it is a private conversation (id1_id2 format)
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

    // 2. Synchroniser vers Supabase avec un payload strict sans champs obsolètes (pas de sender_name)
    if (supabase) {
      try {
        const record = {
          id: messageId,
          conversation_id: conversationId,
          sender_id: senderId,
          text: finalContent,
          created_at: nowIso
        };

        console.log("[ChatService] Inserting message into Supabase 'messages' table with schema-aligned record:", record);

        const { error } = await supabase.from("messages").insert(record);
        if (error) {
          console.warn("[Chat Supabase Notice - Message sauvegardé localement]", error.message, error.code);
        } else {
          await supabase
            .from("conversations")
            .update({ last_message: finalContent, updated_at: nowIso })
            .eq("id", conversationId)
            .then(({ error: convErr }) => {
              if (convErr) console.warn("Notice update conversation Supabase:", convErr.message);
            });
        }
      } catch (e) {
        console.warn("Notice Supabase sendMessage error:", e);
      }
    }

    return messageId;
  },

  /**
   * Téléverser un fichier média pour le chat vers Supabase Storage (Chat)
   */
  async uploadChatMedia(conversationId: string, file: File | Blob, mimeType?: string): Promise<string> {
    if (!supabase) {
      throw new Error("Supabase Storage n'est pas initialisé.");
    }

    const timestamp = Date.now();
    const ext = file instanceof File && file.name ? file.name.split(".").pop() : "bin";
    const storagePath = `chat-media/${conversationId}/${timestamp}.${ext}`;
    const storageBucket = "Chat";

    const res = await uploadToSupabaseStorage(
      storageBucket,
      storagePath,
      file,
      mimeType || (file as any).type || "application/octet-stream"
    );
    if (!res?.publicUrl) {
      throw new Error("Échec upload média chat vers Supabase Storage.");
    }

    return res.publicUrl;
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

    const emitMessages = async () => {
      // Source locale
      const localMsgs = db.getMessages().filter(m => m.conversationId === conversationId);

      // Source Supabase
      let sbMsgs: ChatMessage[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

          if (!error && data) {
            sbMsgs = data.map((row: any) => ({
              id: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              content: row.text || "",
              text: row.text || "",
              type: MessageType.TEXT,
              status: MessageStatus.DELIVERED,
              timestamp: row.created_at || new Date().toISOString(),
              createdAt: row.created_at || new Date().toISOString()
            }));
          }
        } catch (e) {
          console.warn("Notice fetch messages Supabase:", e);
        }
      }

      // Fusionner sans doublons par ID
      const map = new Map<string, ChatMessage>();
      localMsgs.forEach(m => map.set(m.id, m));
      sbMsgs.forEach(m => {
        if (!map.has(m.id)) map.set(m.id, m);
      });

      const sorted = Array.from(map.values()).sort(
        (a, b) => new Date(a.timestamp || a.createdAt || 0).getTime() - new Date(b.timestamp || b.createdAt || 0).getTime()
      );

      callback(sorted);
    };

    emitMessages();

    // Écouteur local
    const handleLocalMsgChange = () => {
      emitMessages();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_messages_updated", handleLocalMsgChange);
    }

    // Écouteur Supabase Realtime
    let channel: any = null;
    if (supabase) {
      try {
        const uniqueId = Math.random().toString(36).substring(7);
        channel = supabase
          .channel(`public:messages:${conversationId}:${uniqueId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
            () => {
              emitMessages();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("Notice channel messages Supabase:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_messages_updated", handleLocalMsgChange);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  },

  /**
   * S'abonner aux conversations d'un utilisateur
   */
  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    if (!userId) return () => {};

    const emitConvs = async () => {
      let sbConvs: Conversation[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("conversations")
            .select("*")
            .contains("participants", [userId])
            .order("updated_at", { ascending: false });

          if (!error && data) {
            sbConvs = data.map((row: any) => {
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
              if (!parsedParts.includes(userId)) parsedParts.push(userId);

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
            });

            const allParticipantIds = sbConvs.flatMap(c => c.participants).filter(Boolean);
            ensureUsersExistLocally(allParticipantIds);
          }
        } catch (e) {
          console.warn("Notice fetch convs Supabase:", e);
        }
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
      sbConvs.forEach(c => {
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

    let channel: any = null;
    if (supabase) {
      try {
        const uniqueId = Math.random().toString(36).substring(7);
        channel = supabase
          .channel(`public:conversations:${userId}:${uniqueId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "conversations" },
            () => {
              emitConvs();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("Notice channel conversations Supabase:", e);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalConnChange);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
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
    const updated = msgs.map(m => m.id === messageId ? { ...m, content: transcription } : m);
    db.saveMessages(updated);

    if (supabase && messageId) {
      try {
        await supabase
          .from("messages")
          .update({ text: transcription })
          .eq("id", messageId);
      } catch (e) {
        console.warn("Notice save transcription:", e);
      }
    }
  }
};
