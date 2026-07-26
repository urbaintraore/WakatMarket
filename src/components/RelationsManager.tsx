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
  const [activeRelations, setActiveRelations] = useState<Relation[]>([]);
  
  // Feedback messages
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // New Request Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [identifiantInput, setIdentifiantInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");

  // Selected profile detail modal
  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  // 1. Setup real-time listeners with strict lifecycle cleanup (unsubscribe)
  useEffect(() => {
    if (!currentUser?.id) return;

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
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
    };
  }, [currentUser?.id]);

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
          Enregistrer un Partenaire
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

        <div className="text-xs text-slate-500 font-semibold px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl">
          Total : {activeRelations.length} partenaire(s) enregistré(s)
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

      {/* MODAL: Enregistrer un Partenaire */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Enregistrer un Partenaire</h3>
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
                      Enregistrer
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
