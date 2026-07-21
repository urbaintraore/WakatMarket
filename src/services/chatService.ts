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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth, handleFirestoreError, OperationType } from "../firebase/firebase";
import { Conversation, ChatMessage, MessageType, MessageStatus } from "../types";

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
        // Fallback for offline mode
        await setDoc(convRef, newConv, { merge: true });
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
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId),
      orderBy("updatedAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => doc.data() as Conversation);
      callback(convs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "conversations");
    });
  },

  /**
   * Listens to messages in a conversation
   */
  subscribeToMessages(convId: string, callback: (msgs: ChatMessage[]) => void) {
    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data() as ChatMessage);
      callback(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${convId}/messages`);
    });
  },

  /**
   * Send a message
   */
  async sendMessage(
    convId: string, 
    senderId: string, 
    type: MessageType, 
    content: string, 
    extra?: Partial<ChatMessage>,
    participantsToNotify?: string[]
  ): Promise<void> {
    try {
      const msgRef = doc(collection(db, "conversations", convId, "messages"));
      
      const newMsg: Partial<ChatMessage> = {
        id: msgRef.id,
        conversationId: convId,
        senderId,
        type,
        content,
        status: MessageStatus.SENT,
        createdAt: new Date().toISOString(),
        readBy: {
          [senderId]: new Date().toISOString()
        },
        ...extra
      };

      // Add the message
      await setDoc(msgRef, newMsg);

      // Update the conversation's last message and unread counts
      const convRef = doc(db, "conversations", convId);
      
      const updates: any = {
        lastMessage: type === MessageType.TEXT ? content : `[${type}]`,
        lastMessageDate: newMsg.createdAt,
        updatedAt: newMsg.createdAt
      };

      if (participantsToNotify) {
        participantsToNotify.forEach(p => {
          if (p !== senderId) {
            updates[`unreadCount.${p}`] = increment(1);
          }
        });
      }

      await setDoc(convRef, updates, { merge: true });

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `conversations/${convId}/messages`);
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
      handleFirestoreError(error, OperationType.UPDATE, `conversations/${convId}`);
    }
  },

  /**
   * Upload media file (Image, Video, Document, Voice note)
   */
  async uploadMedia(file: File | Blob, folder: string, filename: string): Promise<string> {
    try {
      const fileRef = ref(storage, `chat/${folder}/${filename}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (error) {
      console.error("Storage upload error", error);
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
