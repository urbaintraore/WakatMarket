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
    _description?: string,
    _image?: string
  ): Promise<string> {
    const convId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (!supabase) return convId;

    const allParticipants = Array.from(new Set([creatorId, ...participantIds]));
    await supabase.from("conversations").insert({
      id: convId,
      participants: allParticipants,
      last_message: `Groupe ${name} créé`,
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
    _metadata?: Record<string, any>,
    _receiverOrParticipants?: string | string[]
  ): Promise<string> {
    if (!supabase) {
      throw new Error("Supabase n'est pas initialisé.");
    }

    let finalContent = "";

    const allTypes = Object.values(MessageType) as string[];
    if (allTypes.includes(typeOrContent as string)) {
      finalContent = typeof contentOrType === "string" ? contentOrType : String(contentOrType || "");
    } else if (allTypes.includes(contentOrType as string)) {
      finalContent = String(typeOrContent || "");
    } else {
      finalContent = String(typeOrContent || "");
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const record = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: "Expéditeur",
      text: finalContent,
      created_at: nowIso
    };

    const { error } = await supabase.from("messages").insert(record);
    if (error) {
      console.error("Erreur envoi message Supabase:", error);
      throw error;
    }

    // Mettre à jour last_message dans la conversation
    await supabase
      .from("conversations")
      .update({ last_message: finalContent, updated_at: nowIso })
      .eq("id", conversationId);

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
        content: row.text || "",
        type: MessageType.TEXT,
        status: MessageStatus.DELIVERED,
        timestamp: row.created_at || new Date().toISOString(),
        metadata: {}
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
        type: "PRIVATE",
        participants: row.participants || [],
        groupName: "Discussion",
        participantDetails: {},
        unreadCount: {},
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
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
        .update({ text: transcription })
        .eq("id", messageId);
    } catch (e) {
      console.warn("Notice save transcription:", e);
    }
  }
};

