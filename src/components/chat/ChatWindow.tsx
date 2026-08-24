import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Info, Phone, Video, Mic, MicOff, Volume2, VolumeX, PhoneOff, Globe, Smartphone, AlertCircle } from 'lucide-react';
import { Conversation, ChatMessage, UserProfile, MessageType } from '../../types';
import { useAuthContext } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import { connectionService } from '../../services/connectionService';
import { db } from '../../data';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  conversation: Conversation;
  users: UserProfile[];
  onBack: () => void;
}

export function ChatWindow({ conversation, users, onBack }: ChatWindowProps) {
  const { dbUser } = useAuthContext();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Determine current user from conversation participants or dbUser or localStorage
    const otherUserId = conversation.participants.find(p => p !== dbUser?.uid);
    // Find matching user from props users list if dbUser isn't set
    if (dbUser) {
      setCurrentUser({
        id: dbUser.uid,
        name: `${dbUser.prénom} ${dbUser.nom}`,
        email: dbUser.email,
        role: dbUser.rôle as any,
        phone: dbUser.téléphone || '',
        avatar: dbUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        country: dbUser.pays || "Côte d'Ivoire"
      });
    } else {
      // Fallback: pick the first participant or user from storage
      const stored = localStorage.getItem("wakat_erp_v2_user");
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch (e) {}
      }
      if (!currentUser && users.length > 0) {
        // default to first participant who is not the other user
        const myId = conversation.participants[0];
        const found = users.find(u => u.id === myId) || users[0];
        setCurrentUser(found);
      }
    }
  }, [dbUser, conversation, users]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice Call States
  const [isCallingModalOpen, setIsCallingModalOpen] = useState(false);
  const [callType, setCallType] = useState<"webrtc" | "gsm" | null>(null);
  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "connected" | "ended" | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Web Audio ringtone stopper
  const stopRingtoneRef = useRef<(() => void) | null>(null);

  const handleInitiateCall = () => {
    setIsCallingModalOpen(true);
    setCallType(null);
    setCallStatus(null);
    setCallSeconds(0);
  };

  const startWebRTCCall = () => {
    setCallType("webrtc");
    setCallStatus("connecting");
    
    // Transition connecting -> ringing
    setTimeout(() => {
      setCallStatus("ringing");
      const stop = playRingtone();
      stopRingtoneRef.current = stop;

      // Ring for 3 seconds, then connect automatically (as if accepted by other party)
      setTimeout(() => {
        if (stopRingtoneRef.current) {
          stopRingtoneRef.current();
          stopRingtoneRef.current = null;
        }
        setCallStatus("connected");
      }, 3500);
    }, 1000);
  };

  const startGSMCall = () => {
    setCallType("gsm");
    setCallStatus("connected");
    const otherUserId = conversation.participants.find(p => p !== currentUser?.id);
    const otherUser = users.find(u => u.id === otherUserId);
    if (otherUser?.phone) {
      window.location.href = `tel:${otherUser.phone}`;
    }
  };

  const endCall = () => {
    if (stopRingtoneRef.current) {
      stopRingtoneRef.current();
      stopRingtoneRef.current = null;
    }

    const finalDuration = callSeconds;
    setCallStatus("ended");
    setTimeout(() => {
      setIsCallingModalOpen(false);
      setCallType(null);
      setCallStatus(null);
      
      // Auto-send a message to log the completed call in conversation
      if (finalDuration > 0) {
        const minutesStr = Math.floor(finalDuration / 60);
        const secondsStr = finalDuration % 60;
        const durationText = `📞 Appel vocal terminé (${minutesStr}:${secondsStr < 10 ? '0' : ''}${secondsStr})`;
        handleSendMessage(MessageType.TEXT, durationText);
      } else {
        handleSendMessage(MessageType.TEXT, "📞 Appel vocal manqué (sans réponse)");
      }
    }, 1200);
  };

  // Ringing Sound Generator using Web Audio API
  const playRingtone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, audioCtx.currentTime); // Standard European/African ring frequency
      gainNode.gain.setValueAtTime(0.015, audioCtx.currentTime);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();

      // Simple ring-ring interval timer
      const interval = setInterval(() => {
        gainNode.gain.setValueAtTime(0.015, audioCtx.currentTime);
        setTimeout(() => {
          gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        }, 1200);
      }, 3000);

      return () => {
        clearInterval(interval);
        try {
          osc.stop();
          audioCtx.close();
        } catch (e) {}
      };
    } catch (e) {
      console.warn("Web Audio API not supported or blocked by permissions:", e);
      return () => {};
    }
  };

  // Timer Effect
  useEffect(() => {
    let timer: any;
    if (callStatus === "connected" && callType === "webrtc") {
      timer = setInterval(() => {
        setCallSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus, callType]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  useEffect(() => {
    // Subscribe to messages
    const unsubscribe = chatService.subscribeToMessages(conversation.id, (msgs) => {
      setMessages(msgs);
      // Mark as read if there are messages
      if (msgs.length > 0 && currentUser?.id) {
        chatService.markConversationAsRead(conversation.id, currentUser.id);
      }
    });

    return () => unsubscribe();
  }, [conversation.id, currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (
    type: MessageType, 
    content: string, 
    file?: File, 
    location?: { lat: number; lng: number },
    transcription?: string
  ) => {
    if (!currentUser) return;
    
    console.log("=================================================================");
    console.log(`[ChatWindow] >>> TRANSMITTING MESSAGE ATTEMPT INITIATED`);
    console.log(`[ChatWindow] Sender ID: ${currentUser.id} (${currentUser.name})`);
    console.log(`[ChatWindow] Target Conversation ID: ${conversation.id}`);
    console.log(`[ChatWindow] Conversation Participants:`, conversation.participants);
    console.log(`[ChatWindow] Message Type: ${type}, Has File: ${!!file}`);

    const receiverId = Array.isArray(conversation.participants)
      ? conversation.participants.find((p: string) => p !== currentUser.id)
      : undefined;

    if (receiverId) {
      console.log(`[ChatWindow] Running diagnostic check for receiver ${receiverId}...`);
      const diag = await connectionService.validateRelationshipActive(currentUser.id, receiverId);
      console.log(`[ChatWindow] Diagnostic Check Result:`, diag);
      if (!diag.isActive) {
        console.warn(`[ChatWindow] WARNING: Non-active relationship status '${diag.statut}' detected. Details: ${diag.details}`);
      }
    }

    try {
      let finalContent = content;
      let mediaUrl;
      let audioUrl;

      if (file) {
        console.log(`[ChatModule] File selected for upload: name=${file.name}, size=${file.size} bytes, type=${file.type}`);
        let url;
        try {
          console.log(`[ChatModule] Attempting to upload to Supabase Storage...`);
          url = await chatService.uploadMedia(file, type.toLowerCase() + 's', `${Date.now()}_${file.name}`);
          console.log(`[ChatModule] Upload successful. URL obtained: ${url.substring(0, 50)}...`);
        } catch (e) {
          console.warn("[ChatModule] Supabase Storage upload failed. Fallback to base64 encoding.", e);
          if (file.size > 750000) {
            console.error(`[ChatModule] File size (${file.size} bytes) exceeds limit for base64 fallback (750KB).`);
            alert(`Impossible d'envoyer : le fichier de ${(file.size/1000000).toFixed(2)} Mo est trop volumineux pour le mode hors ligne/limité.`);
            return;
          }
          console.log(`[ChatModule] Encoding file to base64...`);
          url = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              console.log(`[ChatModule] Base64 encoding complete. String length: ${(reader.result as string).length}`);
              resolve(reader.result as string);
            };
            reader.readAsDataURL(file);
          });
        }
        if (type === MessageType.AUDIO) audioUrl = url;
        else mediaUrl = url;
      }

      console.log(`[ChatModule] Sending message to chatService.sendMessage...`);
      await chatService.sendMessage(
        conversation.id,
        currentUser.id,
        type,
        finalContent,
        { 
          mediaUrl, 
          audioUrl,
          transcription,
          latitude: location?.lat,
          longitude: location?.lng
        },
        conversation.participants
      );
      console.log(`[ChatModule] Message successfully persisted in database.`);
    } catch (error) {
      console.error("[ChatModule] Error sending message:", error);
      alert("Une erreur s'est produite lors de l'envoi du message.");
    }
  };

  const getConvDisplay = () => {
    if (conversation.type === "GROUP") {
      return {
        name: conversation.groupName || "Groupe",
        image: conversation.groupImage || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150",
        status: `${conversation.participants.length} membres`
      };
    } else {
      const parts = Array.isArray(conversation.participants)
        ? conversation.participants
        : (typeof conversation.participants === "string" ? JSON.parse((conversation.participants as any) || "[]") : []);
      const otherUserId = parts.find((p: string) => p !== currentUser?.id);
      const otherUser = users.find(u => u.id === otherUserId) || db.getUsers().find(u => u.id === otherUserId);
      return {
        name: otherUser?.companyName || otherUser?.name || conversation.groupName || "Partenaire B2B",
        image: otherUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        status: otherUser?.status === "ACTIVE" ? "En ligne" : "Hors ligne"
      };
    }
  };

  const display = getConvDisplay();

  const getSenderInfo = (senderId: string) => {
    return users.find(u => u.id === senderId) || db.getUsers().find(u => u.id === senderId);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-slate-950 h-full relative">
      {/* Texture WhatsApp-like background */}
      <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} />

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 relative z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          
          <img src={display.image} alt={display.name} className="w-10 h-10 rounded-full object-cover bg-gray-200 border border-gray-200 dark:border-slate-700" />
          
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white leading-tight text-sm">
              {display.name}
            </h2>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {display.status}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 text-gray-500">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors hidden sm:block" title="Appel vidéo">
            <Video size={20} />
          </button>
          <button
            onClick={handleInitiateCall}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-emerald-600 dark:text-emerald-400 transition-colors"
            title="Appel vocal"
          >
            <Phone size={20} />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="Informations">
            <Info size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10 scroll-smooth">
        {messages.map((msg, index) => {
          const isOwn = msg.senderId === currentUser?.id;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showAvatar = !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId);
          const senderInfo = getSenderInfo(msg.senderId);

          return (
            <MessageBubble 
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              showAvatar={conversation.type === "GROUP" ? showAvatar : false}
              avatarUrl={senderInfo?.avatar}
              senderName={senderInfo?.companyName || senderInfo?.name}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 relative z-10">
        <ChatInput onSendMessage={handleSendMessage} disabled={!currentUser} />
      </div>

      {/* Voice Call Overlay Modal */}
      {isCallingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-zinc-900 text-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col items-center p-6 space-y-6 border border-zinc-800">
            {callType === null ? (
              // Call Mode Selector Selection
              <div className="w-full space-y-5 flex flex-col items-center">
                <div className="text-center space-y-2 mt-4">
                  <div className="relative">
                    <img
                      src={display.image}
                      alt={display.name}
                      className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-emerald-500/20"
                    />
                    <div className="absolute -bottom-1 -right-1 p-2 bg-emerald-600 rounded-full">
                      <Phone size={16} className="text-white" />
                    </div>
                  </div>
                  <h3 className="font-bold text-lg">{display.name}</h3>
                  <p className="text-xs text-zinc-400">Sélectionnez le mode d'appel vocal</p>
                </div>

                <div className="w-full space-y-2">
                  <button
                    onClick={startWebRTCCall}
                    className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-800 rounded-2xl flex items-center gap-4 transition-colors text-left border border-zinc-700/50"
                  >
                    <div className="p-3 bg-emerald-600/20 text-emerald-500 rounded-xl shrink-0">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400">WakatChat WebRTC</h4>
                      <p className="text-[11px] text-zinc-300">Appel via Internet (Haute Qualité, Gratuit)</p>
                    </div>
                  </button>

                  <button
                    onClick={startGSMCall}
                    className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-800 rounded-2xl flex items-center gap-4 transition-colors text-left border border-zinc-700/50"
                  >
                    <div className="p-3 bg-amber-600/20 text-amber-500 rounded-xl shrink-0">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">Ligne Directe GSM</h4>
                      <p className="text-[11px] text-zinc-300">Appel direct sur le réseau téléphonique</p>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => setIsCallingModalOpen(false)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition"
                >
                  Annuler
                </button>
              </div>
            ) : (
              // Active Calling Screen
              <div className="w-full flex flex-col items-center justify-between min-h-[420px]">
                {/* Header/Status */}
                <div className="text-center space-y-4 pt-6">
                  <div className="relative">
                    <img
                      src={display.image}
                      alt={display.name}
                      className={`w-28 h-28 rounded-full object-cover mx-auto ring-4 ring-emerald-500/30 ${
                        callStatus === "ringing" || callStatus === "connecting" ? "animate-pulse" : ""
                      }`}
                    />
                    {callType === "webrtc" && (
                      <div className="absolute -bottom-1 -right-1 p-2.5 bg-emerald-600 rounded-full">
                        <Globe size={18} className="text-white" />
                      </div>
                    )}
                    {callType === "gsm" && (
                      <div className="absolute -bottom-1 -right-1 p-2.5 bg-amber-600 rounded-full">
                        <Smartphone size={18} className="text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-bold text-xl">{display.name}</h3>
                    <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase">
                      {callType === "webrtc" ? "Appel Vocal WakatChat" : "Appel Réseau GSM"}
                    </p>
                    <p className={`text-sm font-semibold tracking-wide ${
                      callStatus === "connected" ? "text-emerald-400 font-mono text-base" : "text-zinc-400"
                    }`}>
                      {callStatus === "connecting" && "Connexion..."}
                      {callStatus === "ringing" && "Sonnerie..."}
                      {callStatus === "connected" && (callType === "webrtc" ? formatTime(callSeconds) : "Appel en cours")}
                      {callStatus === "ended" && "Appel terminé"}
                    </p>
                  </div>
                </div>

                {/* Simulated Volume Analyzer Meter for WebRTC */}
                {callStatus === "connected" && callType === "webrtc" && (
                  <div className="flex items-center gap-1.5 h-8 my-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1].map((val, idx) => {
                      // Generate slightly randomized animating heights
                      const animationDelay = `${idx * 0.08}s`;
                      return (
                        <span
                          key={idx}
                          style={{ animationDelay }}
                          className={`w-1 bg-emerald-500 rounded-full animate-bounce h-2`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Controls Area */}
                <div className="w-full flex flex-col items-center space-y-5 pb-4">
                  {callType === "webrtc" && (
                    <div className="flex items-center justify-center gap-6">
                      {/* Mute Button */}
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-4 rounded-full transition ${
                          isMuted ? "bg-zinc-700 text-rose-500" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-750"
                        }`}
                        title={isMuted ? "Activer le micro" : "Couper le micro"}
                      >
                        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                      </button>

                      {/* Hang up Button */}
                      <button
                        onClick={endCall}
                        className="p-5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-full text-white transition shadow-lg shadow-rose-600/30"
                        title="Raccrocher"
                      >
                        <PhoneOff size={26} />
                      </button>

                      {/* Speaker Button */}
                      <button
                        onClick={() => setIsSpeaker(!isSpeaker)}
                        className={`p-4 rounded-full transition ${
                          isSpeaker ? "bg-zinc-700 text-emerald-400" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-750"
                        }`}
                        title={isSpeaker ? "Haut-parleur désactivé" : "Haut-parleur activé"}
                      >
                        {isSpeaker ? <Volume2 size={22} /> : <VolumeX size={22} />}
                      </button>
                    </div>
                  )}

                  {callType === "gsm" && (
                    <div className="flex flex-col items-center space-y-3 w-full px-4">
                      <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 text-center w-full">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>Veuillez utiliser le composeur de votre téléphone pour terminer l'appel GSM.</span>
                      </div>
                      <button
                        onClick={endCall}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition"
                      >
                        Fermer la vue d'appel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
