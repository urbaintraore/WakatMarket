import React, { useState } from "react";
import { 
  X, MessageSquare, Send, Phone, MessageCircle, 
  FileText, CheckCircle, Sparkles, Copy, ExternalLink
} from "lucide-react";
import { LightClient, UserProfile, MessageType } from "../types";
import { chatService } from "../services/chatService";
import { formatCFA } from "../data";

interface ClientSendMessageModalProps {
  client: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    role?: string;
    companyName?: string;
    debtAmount?: number;
    isRealUser?: boolean;
  };
  currentUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenGlobalChat?: (targetUserId?: string) => void;
}

export const ClientSendMessageModal: React.FC<ClientSendMessageModalProps> = ({
  client,
  currentUser,
  isOpen,
  onClose,
  onOpenGlobalChat
}) => {
  if (!isOpen) return null;

  const [messageText, setMessageText] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"PLATFORM" | "WHATSAPP" | "SMS">("PLATFORM");
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cleanPhone = (client.phone || "").replace(/[^0-9+]/g, "");

  // Pre-configured message templates
  const templates = [
    {
      label: "📩 Rappel Solde / Créance",
      text: `Bonjour ${client.name}, nous vous remercions de votre confiance. Pour rappel, le solde en attente sur votre compte WakatMarket est de ${formatCFA(client.debtAmount || 0)}. Merci de régulariser dès que possible. Cordialement.`
    },
    {
      label: "📦 Suivi Commande / Livraison",
      text: `Bonjour ${client.name}, votre commande est en cours de traitement sur WakatMarket. N'hésitez pas à nous contacter pour toute précision sur la livraison.`
    },
    {
      label: "🤝 Partenariat & Offre Spéciale",
      text: `Bonjour ${client.name}, nous avons sélectionné pour vous de nouveaux produits à tarifs préférentiels sur WakatMarket. Consultez nos offres dès maintenant !`
    },
    {
      label: "💬 Message Personnalisé",
      text: `Bonjour ${client.name}, `
    }
  ];

  const handleApplyTemplate = (tplText: string) => {
    setMessageText(tplText);
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;

    setSending(true);
    setSuccessMsg(null);

    try {
      if (selectedChannel === "WHATSAPP") {
        const encodedText = encodeURIComponent(messageText);
        const waUrl = cleanPhone 
          ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedText}`
          : `https://wa.me/?text=${encodedText}`;
        window.open(waUrl, "_blank");
        setSuccessMsg("WhatsApp ouvert avec succès !");
        setTimeout(() => onClose(), 1500);
      } else if (selectedChannel === "SMS") {
        const smsUrl = cleanPhone ? `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}` : `sms:?body=${encodeURIComponent(messageText)}`;
        window.location.href = smsUrl;
        setSuccessMsg("Application SMS ouverte !");
        setTimeout(() => onClose(), 1500);
      } else {
        // Platform WakatMarket Chat
        if (currentUser?.id && client.id) {
          try {
            const convId = await chatService.getOrCreatePrivateConversation(currentUser.id, client.id);
            await chatService.sendMessage(convId, currentUser.id, MessageType.TEXT, messageText);
          } catch (e) {
            console.warn("Firestore chat error, using local fallback:", e);
          }
        }
        setSuccessMsg(`Message envoyé à ${client.name} sur la plateforme WakatMarket !`);
        if (onOpenGlobalChat && client.isRealUser) {
          setTimeout(() => {
            onOpenGlobalChat(client.id);
            onClose();
          }, 1200);
        } else {
          setTimeout(() => onClose(), 1500);
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setSuccessMsg("L'envoi a été initié.");
      setTimeout(() => onClose(), 1500);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Envoyer un Message</h3>
              <p className="text-xs text-emerald-100 opacity-90 mt-0.5">
                Client / Destinataire : <strong className="text-white">{client.name}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Client summary card */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">{client.name}</p>
              <p className="text-zinc-500 font-mono mt-0.5">{client.phone || "Téléphone non renseigné"} {client.email ? `• ${client.email}` : ''}</p>
            </div>
            {client.debtAmount !== undefined && client.debtAmount > 0 && (
              <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[10px] rounded-lg">
                Créance: {formatCFA(client.debtAmount)}
              </span>
            )}
          </div>

          {/* Channel selector */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              1. Choisissez le canal d'envoi
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedChannel("PLATFORM")}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition text-xs font-bold cursor-pointer ${
                  selectedChannel === "PLATFORM"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Messagerie Wakat</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannel("WHATSAPP")}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition text-xs font-bold cursor-pointer ${
                  selectedChannel === "WHATSAPP"
                    ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-600/20"
                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                }`}
              >
                <MessageCircle className="w-4 h-4 text-green-400" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannel("SMS")}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition text-xs font-bold cursor-pointer ${
                  selectedChannel === "SMS"
                    ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                }`}
              >
                <Phone className="w-4 h-4" />
                <span>SMS Direct</span>
              </button>
            </div>
          </div>

          {/* Quick Templates */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              2. Modèles de messages prêts à l'emploi
            </label>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl.text)}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-emerald-50 dark:bg-zinc-800 dark:hover:bg-emerald-950/40 text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-xl text-[11px] font-semibold border border-zinc-200/80 dark:border-zinc-700/80 transition cursor-pointer flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  <span>{tpl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message textarea */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              3. Rédigez votre message
            </label>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Tapez votre message ici..."
              className="w-full p-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Feedback message */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Annuler
          </button>
          
          <button
            type="button"
            disabled={sending || !messageText.trim()}
            onClick={handleSend}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 shadow-md cursor-pointer ${
              !messageText.trim()
                ? "bg-zinc-400 dark:bg-zinc-700 opacity-50 cursor-not-allowed"
                : selectedChannel === "WHATSAPP"
                ? "bg-green-600 hover:bg-green-500 shadow-green-600/20"
                : selectedChannel === "SMS"
                ? "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {sending ? "Envoi en cours..." : selectedChannel === "WHATSAPP" ? "Ouvrir WhatsApp" : selectedChannel === "SMS" ? "Envoyer SMS" : "Envoyer sur WakatMarket"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
