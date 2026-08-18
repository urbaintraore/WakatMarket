import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  Search, 
  RefreshCw, 
  Smartphone, 
  Download, 
  ShieldCheck, 
  User, 
  X, 
  AlertTriangle 
} from "lucide-react";
import { supabase } from "../supabase";
import { UserProfile, Order } from "../types";
import { paymentProofService } from "../services/paymentProofService";
import { billingService } from "../services/billingService";

interface PaiementsAValiderModuleProps {
  currentUser?: UserProfile;
  vendeurId?: string;
  vendeurNom?: string;
  addNotification?: (msg: string) => void;
  onPaiementValide?: (venteId: string) => void;
  onPaiementRejete?: (venteId: string) => void;
  onOpenSaleDetails?: (sale: any) => void;
}

export function PaiementsAValiderModule({
  currentUser,
  vendeurId,
  vendeurNom,
  addNotification,
  onPaiementValide,
  onPaiementRejete,
  onOpenSaleDetails
}: PaiementsAValiderModuleProps) {
  const currentId = currentUser?.id || vendeurId || "";
  const currentName = currentUser?.name || currentUser?.companyName || vendeurNom || "Commerçant";
  const currentRole = currentUser?.role || "GROSSISTE";

  const notify = (msg: string) => {
    if (addNotification) addNotification(msg);
  };

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"a_valider" | "valides" | "rejetes" | "tous">("a_valider");
  
  // Lightbox modal state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // Rejection modal state
  const [rejectionTarget, setRejectionTarget] = useState<any | null>(null);
  const [rejectionMotif, setRejectionMotif] = useState("");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!currentId || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchSales = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("seller_id", currentId)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Supabase fetch orders error:", error);
          setLoading(false);
          return;
        }

        const formatted = (data || []).map((row: any) => ({
          id: row.id,
          acheteurId: row.buyer_id,
          acheteurNom: row.buyer_id,
          total: row.total_amount,
          totalAmount: row.total_amount,
          statutPaiement: row.statut_paiement || (row.payment_status === "PAID" ? "valide" : "en_attente_preuve"),
          paymentStatus: row.payment_status,
          preuvePaiementUrl: row.payment_proof_url,
          paymentMethod: row.payment_method || "Mobile Money",
          commentaireRejet: row.rejection_reason,
          lignes: row.items || [],
          createdAt: row.created_at
        }));

        setSales(formatted);
      } catch (err) {
        console.error("Error loading sales from Supabase:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();

    const channel = supabase
      .channel(`public:orders:seller:${currentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${currentId}` },
        () => {
          fetchSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentId]);

  const handleValider = async (sale: any) => {
    setIsProcessing(sale.id);
    try {
      const totalAmount = Number(sale.total || sale.totalAmount || 0);
      const acheteurId = sale.acheteurId || sale.receiverId || sale.clientId || "CLIENT";
      
      await paymentProofService.validerPaiementVente({
        venteId: sale.id,
        vendeurId: currentId,
        vendeurNom: currentName,
        vendeurRole: currentRole,
        acheteurId,
        acheteurNom: sale.acheteurNom || sale.clientNom || "Acheteur Partenaire",
        totalAmount,
        lignes: sale.lignes || sale.items || [],
        typeVente: sale.typeVente || "GROS"
      });

      notify(`Paiement de ${totalAmount.toLocaleString("fr-FR")} FCFA validé. Facture officielle générée.`);
      if (onPaiementValide) onPaiementValide(sale.id);
    } catch (err: any) {
      console.error("Error validating payment:", err);
      notify("Erreur lors de la validation : " + (err.message || "Échec"));
    } finally {
      setIsProcessing(null);
    }
  };

  const handleConfirmerRejet = async () => {
    if (!rejectionTarget) return;
    setIsProcessing(rejectionTarget.id);

    try {
      const acheteurId = rejectionTarget.acheteurId || rejectionTarget.receiverId || rejectionTarget.clientId || "CLIENT";

      await paymentProofService.rejeterPaiementVente({
        venteId: rejectionTarget.id,
        vendeurId: currentId,
        vendeurNom: currentName,
        acheteurId,
        commentaire: rejectionMotif || "Capture de paiement non conforme ou illisible."
      });

      notify("Preuve de paiement rejetée. L'acheteur a été notifié.");
      if (onPaiementRejete) onPaiementRejete(rejectionTarget.id);
      setRejectionTarget(null);
      setRejectionMotif("");
    } catch (err: any) {
      console.error("Error rejecting payment:", err);
      notify("Erreur lors du rejet : " + (err.message || "Échec"));
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDownloadInvoice = async (sale: any) => {
    try {
      const total = Number(sale.total || sale.totalAmount || 0);
      await billingService.genererEtEnregistrerFacture({
        venteId: sale.id,
        vendeurId: currentId,
        vendeurNom: currentName,
        vendeurRole: currentRole,
        acheteurId: sale.acheteurId || sale.receiverId || "CLIENT",
        acheteurNom: sale.acheteurNom || sale.clientNom || "Client",
        lignes: sale.lignes || sale.items || [
          {
            produitId: "PROD-1",
            nom: "Articles commandés",
            quantite: 1,
            prixUnitaire: total,
            sousTotal: total
          }
        ],
        total,
        typeVente: sale.typeVente || "GROS"
      });
      if (addNotification) addNotification("Facture PDF générée et prête au téléchargement.");
    } catch (e: any) {
      console.error("Invoice error:", e);
      if (addNotification) addNotification("Erreur lors de la génération de facture.");
    }
  };

  // Filtrage des ventes
  const filteredSales = sales.filter((item) => {
    const status = item.statutPaiement || (item.paymentStatus === "PAID" ? "valide" : "en_attente_preuve");
    
    // Filtre par onglet
    if (selectedFilter === "a_valider" && status !== "preuve_soumise") return false;
    if (selectedFilter === "valides" && status !== "valide") return false;
    if (selectedFilter === "rejetes" && status !== "rejete") return false;

    // Filtre par recherche
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const idMatch = item.id?.toLowerCase().includes(term);
      const clientMatch = (item.acheteurNom || item.clientNom || "").toLowerCase().includes(term);
      const totalMatch = String(item.total || item.totalAmount || "").includes(term);
      return idMatch || clientMatch || totalMatch;
    }

    return true;
  });

  const countAValider = sales.filter(s => s.statutPaiement === "preuve_soumise").length;

  return (
    <div className="space-y-5 text-left">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Vérification des Paiements Mobile Money
              {countAValider > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-bold animate-pulse">
                  {countAValider} à valider
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-500">
              Vérifiez les captures d'écran transmises par vos acheteurs et déclenchez instantanément l'émission de la facture officielle.
            </p>
          </div>
        </div>
      </div>

      {/* Controls: Search & Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
          <button
            onClick={() => setSelectedFilter("a_valider")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              selectedFilter === "a_valider"
                ? "bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Preuves à valider
            {countAValider > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                {countAValider}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedFilter("valides")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              selectedFilter === "valides"
                ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Validés
          </button>

          <button
            onClick={() => setSelectedFilter("rejetes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              selectedFilter === "rejetes"
                ? "bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Rejetés
          </button>

          <button
            onClick={() => setSelectedFilter("tous")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              selectedFilter === "tous"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            Toutes les ventes
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par ID, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* Sales List */}
      {loading ? (
        <div className="py-12 text-center text-zinc-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
          <p className="text-xs">Chargement des transactions...</p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2">
          <CheckCircle2 className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">
            Aucune transaction dans cette section
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {selectedFilter === "a_valider"
              ? "Toutes les preuves de paiement ont été traitées. Vous serez notifié dès qu'un acheteur soumettra une nouvelle capture."
              : "Aucune vente ne correspond à vos critères de recherche."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSales.map((sale) => {
            const total = Number(sale.total || sale.totalAmount || 0);
            const status = sale.statutPaiement || (sale.paymentStatus === "PAID" ? "valide" : "en_attente_preuve");
            const proofUrl = sale.preuvePaiementUrl;

            return (
              <div
                key={sale.id}
                className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl transition shadow-xs flex flex-col justify-between ${
                  status === "preuve_soumise"
                    ? "border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/20"
                    : status === "valide"
                      ? "border-emerald-200 dark:border-emerald-900/60"
                      : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div>
                  {/* Top line: ID & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                        Vente #{sale.id?.slice(0, 10)}
                      </span>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        {sale.acheteurNom || sale.clientNom || "Client / Partenaire"}
                      </h4>
                    </div>

                    <div>
                      {status === "valide" && (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Validé
                        </span>
                      )}
                      {status === "preuve_soumise" && (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> À vérifier
                        </span>
                      )}
                      {status === "rejete" && (
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Rejeté
                        </span>
                      )}
                      {status === "en_attente_preuve" && (
                        <span className="px-2.5 py-1 bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 rounded-lg text-[10px] font-semibold flex items-center gap-1">
                          En attente preuve
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial & Date details */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl mb-3 border border-zinc-100 dark:border-zinc-700">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-medium">Montant à percevoir</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {total.toLocaleString("fr-FR")} FCFA
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-medium">Mode de règlement</span>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {sale.paymentMethod || "Mobile Money"}
                      </span>
                    </div>
                  </div>

                  {/* Rejection notice if exists */}
                  {status === "rejete" && sale.commentaireRejet && (
                    <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                      <strong>Motif du refus :</strong> "{sale.commentaireRejet}"
                    </div>
                  )}

                  {/* Screenshot Thumbnail Preview */}
                  {proofUrl ? (
                    <div className="mb-3 p-2.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setLightboxImage(proofUrl)}
                          className="w-14 h-14 rounded-lg bg-black overflow-hidden border border-zinc-300 dark:border-zinc-600 cursor-pointer relative group shrink-0"
                        >
                          <img
                            src={proofUrl}
                            alt="Preuve"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                            Capture de Paiement
                          </span>
                          <span className="text-[11px] text-zinc-500 block">
                            Cliquer pour agrandir et vérifier
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLightboxImage(proofUrl)}
                        className="px-2.5 py-1.5 bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-500" /> Agrandir
                      </button>
                    </div>
                  ) : (
                    <div className="mb-3 p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-center text-xs text-zinc-400">
                      Aucune capture d'écran téléversée pour l'instant.
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                  {status === "preuve_soumise" ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => setRejectionTarget(sale)}
                        disabled={isProcessing === sale.id}
                        className="flex-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Rejeter
                      </button>

                      <button
                        type="button"
                        onClick={() => handleValider(sale)}
                        disabled={isProcessing === sale.id}
                        className="flex-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
                      >
                        {isProcessing === sale.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Validation...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Valider le Paiement
                          </>
                        )}
                      </button>
                    </div>
                  ) : status === "valide" ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" /> Encaissé & Facturé
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(sale)}
                        className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-500" />
                        Facture PDF
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      En attente du règlement de l'acheteur
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 text-white hover:bg-black/90 rounded-full transition cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Preuve de paiement grand format"
              className="max-h-[85vh] max-w-full object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-5 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                  Rejeter la preuve de paiement
                </h3>
              </div>
              <button
                onClick={() => setRejectionTarget(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Veuillez indiquer le motif du rejet pour que l'acheteur puisse corriger son transfert Mobile Money et soumettre une nouvelle preuve.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Motif explicatif <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="ex: Montant reçu incomplet, référence introuvable sur notre compte, capture floue..."
                value={rejectionMotif}
                onChange={(e) => setRejectionMotif(e.target.value)}
                className="w-full p-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionTarget(null)}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isProcessing === rejectionTarget.id}
                onClick={handleConfirmerRejet}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/20"
              >
                {isProcessing === rejectionTarget.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
