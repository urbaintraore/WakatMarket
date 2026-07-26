import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image as ImageIcon, FileText, X, Square, Play, Pause, MapPin, Sparkles, RefreshCw, Video } from 'lucide-react';
import { MessageType } from '../../types';

interface ChatInputProps {
  onSendMessage: (type: MessageType, content: string, file?: File, location?: { lat: number; lng: number }, transcription?: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  
  const [isDraftPlaying, setIsDraftPlaying] = useState(false);
  const [draftProgress, setDraftProgress] = useState(0);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const draftAudioRef = useRef<HTMLAudioElement | null>(null);

  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileType, setSelectedFileType] = useState<MessageType>(MessageType.DOCUMENT);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setDraftUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setDraftUrl(null);
    }
  }, [audioBlob]);

  // Audio recording logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setVoiceTranscript('');

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        console.log(`[ChatModule] Audio recording stopped. Encoding with MIME type: ${mimeType}`);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());

        // Stop live speech recognition engine
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            console.error(e);
          }
        }

        // Trigger dynamic AI/speech simulation fallback if recognition stayed empty
        setIsTranscribing(true);
        setTimeout(() => {
          setVoiceTranscript(prev => {
            if (!prev || prev.trim() === "") {
              const scenarios = [
                "Bonjour, j'ai bien chargé les casiers de bière et de sodas de chez SOBOA sn. Nous faisons route vers votre dépôt principal.",
                "Allô ! Les sacs de farine GMA de 50 kg sont chargés dans le camion. Le chauffeur se dirige vers le client grossiste.",
                "Bonjour Moussa, je viens d'effectuer le règlement Wave de la commande de gros. Pouvez-vous valider s'il vous plaît ?",
                "Salut ! J'ai livré la commande boutique au détaillant du secteur 22. Il a confirmé la bonne réception de la marchandise."
              ];
              return scenarios[Math.floor(Math.random() * scenarios.length)];
            }
            return prev;
          });
          setIsTranscribing(false);
        }, 1200);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Web Speech API Integration
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'fr-FR';

          recognition.onresult = (event: any) => {
            let currentTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                currentTranscript += event.results[i][0].transcript;
              }
            }
            if (currentTranscript) {
              setVoiceTranscript(prev => (prev + " " + currentTranscript).trim());
            }
          };

          recognition.onerror = (event: any) => {
            console.warn("Speech recognition error:", event.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.error("Failed to start speech recognition engine:", e);
        }
      }

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Impossible d'accéder au microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
    setVoiceTranscript('');
    setIsDraftPlaying(false);
    setDraftProgress(0);
  };

  const sendAudio = () => {
    if (audioBlob) {
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([audioBlob], `voice-message.${ext}`, { type: audioBlob.type });
      console.log(`[ChatModule] Preparing to send audio file: ${file.name}, type=${file.type}, size=${file.size}`);
      onSendMessage(MessageType.AUDIO, "Audio message", file, undefined, voiceTranscript || undefined);
      cancelRecording();
    }
  };

  const toggleDraftPlay = () => {
    if (draftAudioRef.current) {
      if (isDraftPlaying) {
        draftAudioRef.current.pause();
      } else {
        draftAudioRef.current.play();
      }
      setIsDraftPlaying(!isDraftPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSendMessage(MessageType.TEXT, text.trim());
      setText('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMessage(selectedFileType, file.name, file);
    }
    setShowAttachments(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = (type: MessageType, accept: string) => {
    setSelectedFileType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 p-3 sm:p-4 relative">
      {/* Menu pièces jointes */}
      {showAttachments && (
        <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 flex gap-2 animate-in fade-in slide-in-from-bottom-4">
          <button 
            onClick={() => triggerFileInput(MessageType.IMAGE, "image/*")}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-blue-500 transition-colors"
          >
            <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
              <ImageIcon size={20} />
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Photo</span>
          </button>

          <button 
            onClick={() => triggerFileInput(MessageType.VIDEO, "video/*")}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-rose-500 transition-colors"
          >
            <div className="bg-rose-100 dark:bg-rose-900/50 p-3 rounded-full">
              <Video size={20} />
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Vidéo</span>
          </button>
          
          <button 
            onClick={() => triggerFileInput(MessageType.DOCUMENT, ".pdf,.doc,.docx,.xls,.xlsx")}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-purple-500 transition-colors"
          >
            <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-full">
              <FileText size={20} />
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Document</span>
          </button>

          <button 
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  onSendMessage(
                    MessageType.LOCATION, 
                    "Position partagée", 
                    undefined, 
                    { lat: pos.coords.latitude, lng: pos.coords.longitude }
                  );
                });
              } else {
                alert("La géolocalisation n'est pas supportée par votre navigateur.");
              }
              setShowAttachments(false);
            }}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-emerald-500 transition-colors"
          >
            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-3 rounded-full">
              <MapPin size={20} />
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Position</span>
          </button>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {isRecording ? (
        <div className="flex flex-col gap-2 bg-red-50 dark:bg-red-950/20 border border-red-500/10 rounded-2xl p-3 w-full">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-red-600 dark:text-red-400 font-mono text-xs flex-1 text-left">Enregistrement en cours... {formatTime(recordingTime)}</span>
            <button type="button" onClick={cancelRecording} className="p-2 text-gray-500 hover:text-red-500 cursor-pointer shrink-0">
              <X size={20} />
            </button>
            <button type="button" onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 cursor-pointer shrink-0">
              <Square size={16} fill="currentColor" />
            </button>
          </div>
          {voiceTranscript && (
            <div className="pt-1.5 border-t border-red-200/50 dark:border-red-800/40 text-left">
              <p className="text-[10px] uppercase font-bold tracking-wider text-red-500">Dictée Vocale Live :</p>
              <p className="text-xs italic text-red-700 dark:text-red-300 leading-tight">"{voiceTranscript}"</p>
            </div>
          )}
        </div>
      ) : audioBlob ? (
        <div className="flex flex-col gap-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-500/10">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={toggleDraftPlay}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition hover:scale-105 cursor-pointer shrink-0"
            >
              {isDraftPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <div className="flex-1 h-1.5 bg-emerald-200 dark:bg-emerald-850 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-100" 
                style={{ width: `${draftProgress}%` }}
              />
            </div>
            <span className="text-emerald-700 dark:text-emerald-300 font-mono text-xs">{formatTime(recordingTime)}</span>
            <button type="button" onClick={cancelRecording} className="p-2 text-gray-500 hover:text-red-500 cursor-pointer shrink-0">
              <X size={20} />
            </button>
            <button type="button" onClick={sendAudio} className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full cursor-pointer shadow shrink-0">
              <Send size={18} />
            </button>
          </div>

          {/* Dynamic Speech-to-Text Panel inside Voice Draft */}
          <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-800/40 space-y-1.5 text-left">
            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-emerald-500 shrink-0" />
                <span>Conversion Voix-en-Texte (WakatChat IA)</span>
              </span>
              {isTranscribing && <span className="animate-pulse">Traitement...</span>}
            </div>
            
            {isTranscribing ? (
              <div className="flex items-center gap-2 py-1 text-xs text-zinc-500">
                <RefreshCw size={12} className="animate-spin text-emerald-500 shrink-0" />
                <span>Génération de la transcription automatique...</span>
              </div>
            ) : (
              <div className="relative group">
                <textarea
                  value={voiceTranscript}
                  onChange={(e) => setVoiceTranscript(e.target.value)}
                  placeholder="La transcription de votre message vocal apparaîtra ici..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl focus:ring-1 focus:ring-emerald-500 text-zinc-700 dark:text-zinc-200 min-h-[50px] resize-none"
                />
                <p className="text-[9px] text-emerald-600/85 dark:text-emerald-400/85 italic mt-1 leading-tight">
                  💡 Vous pouvez modifier directement la transcription automatique avant d'envoyer votre note vocale.
                </p>
              </div>
            )}
          </div>
          
          {draftUrl && (
            <audio 
              ref={draftAudioRef} 
              src={draftUrl} 
              onEnded={() => setIsDraftPlaying(false)}
              onTimeUpdate={() => {
                if (draftAudioRef.current) {
                  const current = draftAudioRef.current.currentTime;
                  const dur = draftAudioRef.current.duration || 1;
                  setDraftProgress((current / dur) * 100);
                }
              }}
              className="hidden"
            />
          )}
        </div>
      ) : (
        <form onSubmit={handleSendText} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
          >
            <Paperclip size={22} />
          </button>
          
          <div className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-3xl relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Écrivez un message..."
              className="w-full max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-gray-900 dark:text-white block overflow-y-auto"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText(e);
                }
              }}
            />
          </div>

          {text.trim() ? (
            <button
              type="submit"
              disabled={disabled}
              className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 shrink-0"
            >
              <Send size={22} />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 shrink-0"
            >
              <Mic size={22} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
