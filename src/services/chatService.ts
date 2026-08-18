import { Conversation, ChatMessage, MessageType, MessageStatus } from "../types";
import { supabase, uploadToSupabaseStorage } from "../supabase";

export const chatService = {
  /**
   * Récupérer ou créer une conversation privée
   */
  async getOrCreatePrivateConversation(currentUserId: string, otherUserId: string, _context?: any): Promise<string> {
    const convId = [currentUserId, otherUserId].sort().join("_");
    if (!supabase) return convId;

    try {
      await supabase.from("conversations").upsert({
        id: convId,
        type: "PRIVATE",
        participants: [currentUserId, otherUserId],
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
    description?: string,
    image?: string
  ): Promise<string> {
    const convId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (!supabase) return convId;

    const allParticipants = Array.from(new Set([creatorId, ...participantIds]));
    await supabase.from("conversations").insert({
      id: convId,
      type: "GROUP",
      group_name: name,
      group_description: description || "",
      group_image: image || "",
      created_by: creatorId,
      participants: allParticipants,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return convId;
  },

  /**
   * Envoyer un message dans une conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    typeOrContent: MessageType | string,
    contentOrType: string | MessageType = "",
    metadata?: Record<string, any>,
    _receiverOrParticipants?: string | string[]
  ): Promise<string> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    let finalType: MessageType = MessageType.TEXT;
    let finalContent = "";

    const allTypes = Object.values(MessageType) as string[];
    if (allTypes.includes(typeOrContent as string)) {
      finalType = typeOrContent as MessageType;
      finalContent = typeof contentOrType === "string" ? contentOrType : String(contentOrType || "");
    } else if (allTypes.includes(contentOrType as string)) {
      finalContent = String(typeOrContent || "");
      finalType = contentOrType as MessageType;
    } else {
      finalContent = String(typeOrContent || "");
      finalType = MessageType.TEXT;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const record = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      content: finalContent,
      type: finalType || MessageType.TEXT,
      status: MessageStatus.SENT,
      metadata: metadata || {},
      created_at: nowIso
    };

    const { error } = await supabase.from("messages").insert(record);
    if (error) {
      console.error("Erreur envoi message Supabase:", error);
      throw error;
    }

    // Mettre à jour la date de mise à jour de la conversation
    await supabase
      .from("conversations")
      .update({ updated_at: nowIso })
      .eq("id", conversationId);

    return messageId;
  },

  /**
   * Téléverser un fichier média pour le chat vers Supabase Storage (MonBucket)
   */
  async uploadChatMedia(conversationId: string, file: File | Blob, mimeType?: string): Promise<string> {
    if (!supabase) {
      throw new Error("Supabase Storage n'est pas initialisé.");
    }

    const timestamp = Date.now();
    const ext = file instanceof File && file.name ? file.name.split(".").pop() : "bin";
    const storagePath = `chat-media/${conversationId}/${timestamp}.${ext}`;
    const storageBucket = "MonBucket";

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
    if (!supabase || !conversationId) return () => {};

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erreur fetch messages Supabase:", error);
        return;
      }

      const list: ChatMessage[] = (data || []).map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        content: row.content,
        type: row.type || MessageType.TEXT,
        status: (row.status as MessageStatus) || MessageStatus.DELIVERED,
        timestamp: row.created_at,
        metadata: row.metadata || {}
      }));

      callback(list);
    };

    fetchMessages();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:messages:${conversationId}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * S'abonner aux conversations d'un utilisateur
   */
  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    if (!supabase || !userId) return () => {};

    const fetchConvs = async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .contains("participants", [userId])
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Erreur fetch conversations Supabase:", error);
        return;
      }

      const list: Conversation[] = (data || []).map((row: any) => ({
        id: row.id,
        type: row.type || "PRIVATE",
        participants: row.participants || [],
        groupName: row.group_name,
        groupDescription: row.group_description,
        groupImage: row.group_image,
        createdBy: row.created_by,
        participantDetails: {},
        unreadCount: {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      callback(list);
    };

    fetchConvs();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:conversations:${userId}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          fetchConvs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
    // Read state management
    return;
  },

  /**
   * Sauvegarder une transcription audio
   */
  async saveTranscription(messageId: string, transcription: string, _conversationId?: string): Promise<void> {
    if (!supabase || !messageId) return;
    try {
      await supabase
        .from("messages")
        .update({ content: transcription })
        .eq("id", messageId);
    } catch (e) {
      console.warn("Notice save transcription:", e);
    }
  }
};
