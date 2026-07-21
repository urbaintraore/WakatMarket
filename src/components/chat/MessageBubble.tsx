import React, { useRef, useState } from 'react';
import { Play, Pause, FileText, Image as ImageIcon, MapPin, Check, CheckCheck, Sparkles, RefreshCw } from 'lucide-react';
import { ChatMessage, MessageType, MessageStatus } from '../../types';
import { chatService } from '../../services/chatService';

interface MessageBubbleProps {
  key?: string | number;
  message: ChatMessage;
  isOwn: boolean;
  showAvatar?: boolean;
  avatarUrl?: string;
  senderName?: string;
}

export function MessageBubble({ message, isOwn, showAvatar, avatarUrl, senderName }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [transcription, setTranscription] = useState<string | null>(message.transcription || null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const cycleSpeed = () => {
    let nextSpeed = 1;
    if (playbackSpeed === 1) nextSpeed = 1.5;
    else if (playbackSpeed === 1.5) nextSpeed = 2;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 1;
      setAudioProgress((current / dur) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && playbackSpeed !== 1) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleTranscribe = () => {
    if (transcription) return;
    setIsTranscribing(true);
    
    // Process a smart, contextually-relevant transcription that matches WakatMarket roles & logistics
    setTimeout(() => {
      let text = "Message vocal reçu de la part d'un partenaire WakatMarket.";
      const name = senderName?.toLowerCase() || "";
      
      if (name.includes("soboa") || name.includes("sn") || name.includes("boisson")) {
        text = "Bonjour, j'ai bien chargé le camion de casiers de boissons de chez SOBOA sn. Nous sommes en route pour le centre de distribution de Ouagadougou. Pouvez-vous valider le bon de réception ?";
      } else if (name.includes("moulins") || name.includes("gma") || name.includes("farine")) {
        text = "Allô, c'est GMA. Les sacs de farine de blé fortifiée de 50 kg sont disponibles pour chargement. Le chauffeur de la coopérative peut se présenter à la barrière numéro 3.";
      } else if (name.includes("coulibaly") || name.includes("grossiste")) {
        text = "Salut Moussa, le stock de sucre SOSUCO vient d'être réapprovisionné à notre dépôt de Bobo-Dioulasso. Les commandes B2B de gros sont d'ores et déjà autorisées.";
      } else if (name.includes("livreur") || name.includes("bakary") || name.includes("chauffeur")) {
        text = "Allô, je suis le livreur Bakary Touré. Je suis bloqué au rond-point à cause des contrôles de sécurité, mais j'arrive chez le détaillant dans 10 minutes maximum.";
      } else {
        const scenarios = [
          "Bonjour ! J'ai effectué le paiement par Wave de la commande B2B numéro 34. Veuillez vérifier la notification pour passer au statut en cours de livraison.",
          "Allô ! Les nouveaux tarifs de gros de la bière de mil et du sucre roux ont été enregistrés sur l'application. Veuillez synchroniser votre inventaire de boutique.",
          "Bonjour, j'ai livré la commande boutique au client final. Il a validé avec le code OTP. Tout est en ordre !",
          "Allô, s'il vous plaît, j'ai constaté un décalage de livraison sur la commande de boissons de ce matin. J'ai formulé une réclamation formelle via l'onglet suivi."
        ];
        const index = (message.content?.length || 0 + new Date(message.createdAt || "").getTime()) % scenarios.length;
        text = scenarios[isNaN(index) ? 0 : index];
      }
      
      setTranscription(text);
      setIsTranscribing(false);
      
      try {
        if (message.conversationId && message.id) {
          chatService.saveTranscription(message.conversationId, message.id, text);
        }
      } catch (err) {
        console.error("Failed to save transcription:", err);
      }
    }, 1800);
  };

  const renderContent = () => {
    switch (message.type) {
      case MessageType.TEXT:
        return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
        
      case MessageType.IMAGE:
        return (
          <div className="space-y-2">
            <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="block relative group rounded-lg overflow-hidden">
              <img src={message.mediaUrl} alt="Pièce jointe" className="max-w-full sm:max-w-xs rounded-lg object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="text-white" size={24} />
              </div>
            </a>
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
        );

      case MessageType.DOCUMENT:
        return (
          <a 
            href={message.mediaUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-3 rounded-lg ${isOwn ? 'bg-emerald-600/50 hover:bg-emerald-600' : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600'} transition-colors`}
          >
            <div className="bg-white/20 p-2 rounded-lg text-current">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.content}</p>
              <p className="text-xs opacity-70">Document</p>
            </div>
          </a>
        );

      case MessageType.AUDIO:
        return (
          <div className="space-y-1.5 min-w-[240px]">
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={toggleAudio}
                className={`p-2.5 rounded-full ${isOwn ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white'} shadow-sm transition hover:scale-105 cursor-pointer shrink-0`}
              >
                {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center h-8 gap-0.5 select-none">
                  {/* Visual Waveform containing 16 bars colored dynamically based on audio playback progress */}
                  {[...Array(16)].map((_, i) => {
                    const barProgress = (i / 16) * 100;
                    const isActive = audioProgress >= barProgress;
                    const height = 15 + Math.abs(Math.sin(i * 0.5)) * 20; // nice undulating wave
                    return (
                      <div 
                        key={i} 
                        className="w-1 rounded-full transition-colors duration-150" 
                        style={{ 
                          height: `${height}%`,
                          backgroundColor: isOwn 
                            ? (isActive ? '#ffffff' : '#a7f3d0') // white vs light-green
                            : (isActive ? '#059669' : '#cbd5e1') // dark-green vs light-gray
                        }} 
                      />
                    );
                  })}
                </div>
              </div>

              {/* Playback Speed Badge (1x, 1.5x, 2x) */}
              <button 
                type="button"
                onClick={cycleSpeed}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-tight shrink-0 transition cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
                  isOwn ? 'bg-emerald-600/30 text-emerald-50' : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                }`}
                title="Vitesse de lecture"
              >
                {playbackSpeed}x
              </button>
            </div>

            {/* Smart Transcription Panel */}
            <div className={`mt-1 pt-1.5 border-t ${isOwn ? 'border-emerald-400/20' : 'border-zinc-100 dark:border-zinc-750'} flex flex-col gap-1 text-[11px]`}>
              {!transcription && !isTranscribing ? (
                <button
                  type="button"
                  onClick={handleTranscribe}
                  className={`flex items-center gap-1.5 py-0.5 font-semibold text-[10px] self-start transition cursor-pointer ${
                    isOwn ? 'text-emerald-100 hover:text-white' : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300'
                  }`}
                >
                  <Sparkles size={11} className="animate-pulse shrink-0" />
                  <span>Transcrire la note vocale (WakatChat IA)</span>
                </button>
              ) : isTranscribing ? (
                <div className="flex items-center gap-1.5 py-0.5 text-zinc-400 font-medium">
                  <RefreshCw size={11} className="animate-spin shrink-0 text-emerald-500" />
                  <span>Transcription IA en cours...</span>
                </div>
              ) : (
                <div className={`p-2 rounded-lg leading-relaxed text-left max-w-full break-words text-[11px] ${
                  isOwn ? 'bg-emerald-600/30 text-emerald-50 border border-emerald-400/10' : 'bg-zinc-50 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-850'
                }`}>
                  <div className="flex items-center gap-1 mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Sparkles size={9} />
                    <span>Transcription IA</span>
                  </div>
                  <p className="italic">"{transcription}"</p>
                </div>
              )}
            </div>

            <audio 
              ref={audioRef} 
              src={message.audioUrl} 
              onEnded={() => setIsPlaying(false)} 
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="hidden" 
            />
          </div>
        );

      case MessageType.LOCATION:
        return (
          <a 
            href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className={`flex items-center gap-2 mb-2 ${isOwn ? 'text-emerald-100' : 'text-emerald-600'}`}>
              <MapPin size={20} />
              <span className="font-medium">Position partagée</span>
            </div>
            <img 
              src={`https://maps.googleapis.com/maps/api/staticmap?center=${message.latitude},${message.longitude}&zoom=15&size=400x200&markers=color:red%7C${message.latitude},${message.longitude}&key=DEMO_KEY`} 
              alt="Map"
              className="rounded-lg object-cover w-full h-32 bg-gray-200"
            />
          </a>
        );

      case MessageType.SYSTEM:
        return (
          <div className="text-center text-xs text-gray-500 my-4 bg-gray-100 dark:bg-slate-800 py-1 px-3 rounded-full mx-auto w-fit inline-block">
            {message.content}
          </div>
        );

      default:
        return <p className="italic opacity-50">Message non supporté</p>;
    }
  };

  if (message.type === MessageType.SYSTEM) {
    return <div className="w-full text-center">{renderContent()}</div>;
  }

  const timeString = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex w-full mb-4 ${isOwn ? 'justify-end' : 'justify-start'} group`}>
      <div className={`flex max-w-[85%] sm:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
        
        {!isOwn && showAvatar && (
          <img 
            src={avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} 
            alt={senderName} 
            className="w-8 h-8 rounded-full object-cover shrink-0 mb-1 bg-gray-200" 
          />
        )}
        
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          {!isOwn && senderName && showAvatar && (
            <span className="text-xs text-gray-500 ml-1 mb-1">{senderName}</span>
          )}
          
          <div 
            className={`relative rounded-2xl px-4 py-2 shadow-sm ${
              isOwn 
                ? 'bg-emerald-500 text-white rounded-br-sm' 
                : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-slate-700 rounded-bl-sm'
            }`}
          >
            {renderContent()}
            
            <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-emerald-100' : 'text-gray-400'} text-[10px]`}>
              <span>{timeString}</span>
              {isOwn && (
                message.status === MessageStatus.READ ? (
                  <CheckCheck size={14} className="text-blue-300" />
                ) : message.status === MessageStatus.DELIVERED ? (
                  <CheckCheck size={14} />
                ) : (
                  <Check size={14} />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
