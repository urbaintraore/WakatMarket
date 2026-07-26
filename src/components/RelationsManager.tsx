import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  MessageSquare, 
  UserCheck, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  Building2, 
  Phone, 
  Mail, 
  Eye, 
  ShieldCheck, 
  WifiOff, 
  Info,
  Send
} from "lucide-react";
import { relationService } from "../services/relationService";
import { Relation, UserProfile, UserRole } from "../types";
import { db as localDb } from "../data";

interface RelationsManagerProps {
  currentUser: UserProfile;
  onOpenChatWithUser?: (userId: string) => void;
  onSelectPartnerProfile?: (user: UserProfile) => void;
}

export const RelationsManager: React.FC<RelationsManagerProps> = ({
  currentUser,
  onOpenChatWithUser,
  onSelectPartnerProfile
}) => {
  const [incomingRequests, setIncomingRequests] = useState<Relation[]>([]);
  const [activeRelations, setActiveRelations] = useState<Relation[]>([]);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  
  // Feedback messages
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // New Request Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [identifiantInput, setIdentifiantInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"tous" | "attente" | "actifs">("tous");

  // Selected profile detail modal
  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  // 1. Setup real-time listeners with strict lifecycle cleanup (unsubscribe)
  useEffect(() => {
    if (!currentUser?.id) return;

    // Listener for incoming pending requests
    const unsubIncoming = relationService.subscribeToIncomingRequests(currentUser.id, (requests) => {
      setIncomingRequests(requests);
    });

    // Helper to refresh active relations list
    const refreshActiveRelations = () => {
      const allConns = localDb.getConnections();
      const userConns = allConns.filter(c => 
        (c.senderId === currentUser.id || c.receiverId === currentUser.id)
      );

      const mapped: Relation[] = userConns.map(c => ({
        id: c.id,
        demandeurId: c.senderId,
        destinataireId: c.receiverId,
        statut: c.status === "active" ? "actif" : (c.status === "en_attente" ? "en_attente" : "refuse"),
        dateCreation: c.createdAt,
        dateReponse: c.updatedAt,
        participants: [c.senderId, c.receiverId],
        notes: c.notes,
        demandeurNom: c.senderName,
        demandeurRole: c.senderRole,
        destinataireNom: c.receiverName,
        destinataireRole: c.receiverRole
      }));

      setActiveRelations(mapped);
    };

    refreshActiveRelations();

    const handleLocalUpdate = () => refreshActiveRelations();
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_connections_updated", handleLocalUpdate);
      window.addEventListener("storage", handleLocalUpdate);
    }

    return () => {
      unsubIncoming();
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
    };
  }, [currentUser?.id]);

  // Handle Response (Accepter ou Refuser)
  const handleRepondre = async (relation: Relation, reponse: "accepter" | "refuser") => {
    setLoadingActionId(relation.id);
    setStatusMessage(null);

    try {
      await relationService.repondreDemandeConnexion(currentUser.id, relation.id, reponse);
      
      const partnerNom = relation.demandeurId === currentUser.id ? relation.destinataireNom : relation.demandeurNom;
      
      setStatusMessage({
        type: "success",
        text: reponse === "accepter" 
          ? `Partenariat avec ${partnerNom || "le membre"} validé avec succès !`
          : `Demande de connexion déclinée.`
      });

      // Local update UI state
      setIncomingRequests(prev => prev.filter(r => r.id !== relation.id));
      setActiveRelations(prev => prev.map(r => {
        if (r.id === relation.id) {
          return { ...r, statut: reponse === "accepter" ? "actif" : "refuse" };
        }
        return r;
      }));
    } catch (err: any) {
      console.error("Erreur réponse demande connexion:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Erreur lors du traitement de la demande."
      });
    } finally {
      setLoadingActionId(null);
    }
  };

  // Submit New Relation Request
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiantInput.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await relationService.envoyerDemandeConnexion(
        currentUser, 
        identifiantInput.trim(), 
        notesInput.trim()
      );

      setStatusMessage({
        type: "success",
        text: res.message
      });

      setIsModalOpen(false);
      setIdentifiantInput("");
      setNotesInput("");

      // Refresh list
      const allConns = localDb.getConnections();
      const userConns = allConns.filter(c => (c.senderId === currentUser.id || c.receiverId === currentUser.id));
      setActiveRelations(userConns.map(c => ({
        id: c.id,
        demandeurId: c.senderId,
        destinataireId: c.receiverId,
        statut: c.status === "active" ? "actif" : (c.status === "en_attente" ? "en_attente" : "refuse"),
        dateCreation: c.createdAt,
        dateReponse: c.updatedAt,
        participants: [c.senderId, c.receiverId],
        notes: c.notes,
        demandeurNom: c.senderName,
        demandeurRole: c.senderRole,
        destinataireNom: c.receiverName,
        destinataireRole: c.receiverRole
      })));

    } catch (err: any) {
      console.error("Erreur envoi demande:", err);
      setStatusMessage({
        type: "error",
        text: err.message || "Impossible de transmettre la demande de connexion."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open detail profile
  const handleOpenProfile = (partnerUid: string) => {
    const foundUser = localDb.getUsers().find(u => u.id === partnerUid);
    if (foundUser) {
      setSelectedPartner(foundUser);
    } else {
      setStatusMessage({
        type: "info",
        text: "Données de profil du partenaire chargées."
      });
    }
  };

  // Filter items
  const filteredRelations = activeRelations.filter(r => {
    const isSender = r.demandeurId === currentUser.id;
    const partnerName = isSender ? r.destinataireNom : r.demandeurNom;
    const partnerRole = isSender ? r.destinataireRole : r.demandeurRole;

    const matchesSearch = !searchTerm.trim() || 
      (partnerName && partnerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (partnerRole && partnerRole.toLowerCase().includes(searchTerm.toLowerCase()));

    if (activeTab === "attente") return matchesSearch && r.statut === "en_attente";
    if (activeTab === "actifs") return matchesSearch && r.statut === "actif";
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      
      {/* Offline Alert Indicator */}
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800 text-sm shadow-sm">
          <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold">Mode hors-ligne actif</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Vos demandes et validations sont conservées localement et seront synchronisées dès le rétablissement du réseau.
            </p>
          </div>
        </div>
      )}

      {/* Global Status Toast */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-md transition-all ${
          statusMessage.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" :
          statusMessage.type === "error" ? "bg-red-50 border border-red-200 text-red-800" :
          "bg-blue-50 border border-blue-200 text-blue-800"
        }`}>
          <div className="flex items-center gap-3">
            {statusMessage.type === "success" && <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
            {statusMessage.type === "error" && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
            {statusMessage.type === "info" && <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. BANNIÈRE EN HAUT: Demandes de connexion EN ATTENTE */}
      {incomingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md animate-bounce">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Demandes de partenariat en attente ({incomingRequests.length})
                </h3>
                <p className="text-xs text-slate-600">
                  Des acteurs B2B souhaitent se connecter avec vous pour échanger et consulter les catalogues.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-amber-200 text-amber-900 rounded-full">
              Action requise
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incomingRequests.map((req) => (
              <div key={req.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                      {req.demandeurNom ? req.demandeurNom.charAt(0).toUpperCase() : "P"}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{req.demandeurNom || "Partenaire B2B"}</h4>
                      <p className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {req.demandeurRole || "Partenaire"}
                      </p>
                      {req.notes && (
                        <p className="text-xs italic text-slate-500 mt-1.5 bg-slate-50 p-1.5 rounded border border-slate-100">
                          "{req.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={loadingActionId === req.id}
                    onClick={() => handleRepondre(req, "accepter")}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                  >
                    {loadingActionId === req.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Accepter
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={loadingActionId === req.id}
                    onClick={() => handleRepondre(req, "refuser")}
                    className="py-2 px-3 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    Refuser
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenProfile(req.demandeurId)}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Consulter le profil"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Header & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-amber-600" />
            <h2 className="text-xl font-bold text-slate-900">Carnet de Relations B2B</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gérez vos partenariats directs (Fabricants, Grossistes, Demi-Grossistes, Détaillants) pour sécuriser vos échanges.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all focus:ring-2 focus:ring-amber-500"
        >
          <UserPlus className="w-4 h-4" />
          Nouvelle Demande de Partenariat
        </button>
      </div>

      {/* Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("tous")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "tous" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tous ({activeRelations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("actifs")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "actifs" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Actifs ({activeRelations.filter(r => r.statut === "actif").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("attente")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "attente" ? "bg-white text-amber-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            En attente ({activeRelations.filter(r => r.statut === "en_attente").length})
          </button>
        </div>
      </div>

      {/* Relations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRelations.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-sm">Aucun partenaire trouvé.</p>
            <p className="text-xs text-slate-400 mt-1">
              Envoyez une demande de connexion par numéro ou e-mail pour établir votre réseau B2B.
            </p>
          </div>
        ) : (
          filteredRelations.map((rel) => {
            const isSender = rel.demandeurId === currentUser.id;
            const partnerUid = isSender ? rel.destinataireId : rel.demandeurId;
            const partnerNom = isSender ? rel.destinataireNom : rel.demandeurNom;
            const partnerRole = isSender ? rel.destinataireRole : rel.demandeurRole;
            const isActif = rel.statut === "actif";

            return (
              <div
                key={rel.id}
                className={`bg-white p-5 rounded-2xl border transition-all shadow-sm flex flex-col justify-between gap-4 ${
                  isActif ? "border-slate-200 hover:border-emerald-300" : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-base shadow-inner">
                        {partnerNom ? partnerNom.charAt(0).toUpperCase() : "P"}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{partnerNom || "Partenaire B2B"}</h4>
                        <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md inline-block mt-0.5">
                          {partnerRole || "Acteur B2B"}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      rel.statut === "actif" ? "bg-emerald-100 text-emerald-800" :
                      rel.statut === "en_attente" ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {rel.statut === "actif" ? "Actif" : rel.statut === "en_attente" ? "En attente" : "Refusé"}
                    </span>
                  </div>

                  {rel.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {rel.notes}
                    </p>
                  )}
                </div>

                {/* Bottom Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenProfile(partnerUid)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Profil
                  </button>

                  {isActif && onOpenChatWithUser && (
                    <button
                      type="button"
                      onClick={() => onOpenChatWithUser(partnerUid)}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Discuter
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Nouvelle Demande de Partenariat */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Envoyer une demande</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Téléphone ou E-mail du partenaire <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: 70000000 ou partenaire@wakat.bf"
                    value={identifiantInput}
                    onChange={(e) => setIdentifiantInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Recherche automatique par numéro ou adresse e-mail enregistré sur WakatMarket.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note ou message (Optionnel)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Bonjour, nous aimerions distribuer vos produits dans la région du Centre..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !identifiantInput.trim()}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Transmettre
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Détail du profil partenaire */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-lg">
                  {selectedPartner.companyName?.charAt(0) || selectedPartner.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedPartner.companyName || selectedPartner.name}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                    {selectedPartner.role}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <Phone className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span><strong>Téléphone :</strong> {selectedPartner.phone || "Non renseigné"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <Mail className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span><strong>E-mail :</strong> {selectedPartner.email || "Non renseigné"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                <Building2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span><strong>Localisation :</strong> {selectedPartner.region || "Burkina Faso"} ({selectedPartner.commune || selectedPartner.country})</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
