import React, { useState, useEffect, useMemo } from "react";
import { Star, MessageSquare, Plus, PenTool, CheckCircle, Search, Filter, AlertCircle, Building, Award, Calendar } from "lucide-react";
import { UserProfile, Connection, isConnectionActive } from "../types";
import { formatCFA } from "../data";

export interface PartnerReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerCompanyName?: string;
  reviewerRole: string;
  targetId: string;
  targetName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface PartnerReviewsSectionProps {
  currentUser: UserProfile;
  users: UserProfile[];
  connections: Connection[];
}

const DEFAULT_PARTNER_REVIEWS: PartnerReview[] = [
  {
    id: "rev-1",
    reviewerId: "user-semi-1",
    reviewerName: "Saliou Diop",
    reviewerCompanyName: "Saliou Grossiste & Cie",
    reviewerRole: "SEMI_WHOLESALER",
    targetId: "user-whole-1",
    targetName: "Moussa Traoré (Grossiste)",
    rating: 5,
    comment: "Excellent partenaire. Toujours ponctuel sur les livraisons de boissons et produits alimentaires. Le stock annoncé sur WakatMarket est toujours 100% fiable !",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "rev-2",
    reviewerId: "user-ret-1",
    reviewerName: "Aminata Koné",
    reviewerCompanyName: "Alimentation Générale de l'Est",
    reviewerRole: "RETAILER",
    targetId: "user-semi-1",
    targetName: "Saliou Diop (Demi-Grossiste)",
    rating: 4,
    comment: "Bons prix de gros et commande minimum très accessible pour les petits détaillants de quartier. Je recommande vivement pour s'approvisionner rapidement.",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "rev-3",
    reviewerId: "user-whole-1",
    reviewerName: "Moussa Traoré",
    reviewerCompanyName: "Traoré Import-Export",
    reviewerRole: "WHOLESALER",
    targetId: "user-semi-1",
    targetName: "Saliou Diop (Demi-Grossiste)",
    rating: 5,
    comment: "Saliou est un acheteur de confiance. Paiements rapides et communication claire via la messagerie intégrée. Un plaisir de faire du business avec lui.",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export function PartnerReviewsSection({ currentUser, users, connections }: PartnerReviewsSectionProps) {
  const [reviews, setReviews] = useState<PartnerReview[]>([]);
  const [activeTab, setActiveTab] = useState<"received" | "given" | "write">("received");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | "all">("all");

  // Write Review Form State
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  // Load reviews from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("wakat_partner_reviews");
    if (stored) {
      try {
        setReviews(JSON.parse(stored));
      } catch (e) {
        setReviews(DEFAULT_PARTNER_REVIEWS);
      }
    } else {
      localStorage.setItem("wakat_partner_reviews", JSON.stringify(DEFAULT_PARTNER_REVIEWS));
      setReviews(DEFAULT_PARTNER_REVIEWS);
    }
  }, []);

  // Save reviews to localStorage
  const saveReviews = (updated: PartnerReview[]) => {
    setReviews(updated);
    localStorage.setItem("wakat_partner_reviews", JSON.stringify(updated));
  };

  // Find connected partners (wholesalers, semi-wholesalers, retailers)
  const connectedPartners = useMemo(() => {
    const partnerIds = connections
      .filter(c => isConnectionActive(c) && (c.senderId === currentUser.id || c.receiverId === currentUser.id))
      .map(c => c.senderId === currentUser.id ? c.receiverId : c.senderId);

    return users.filter(u => partnerIds.includes(u.id) && u.id !== currentUser.id);
  }, [users, connections, currentUser.id]);

  // Reviews received by the current user
  const reviewsReceived = useMemo(() => {
    return reviews.filter(r => r.targetId === currentUser.id);
  }, [reviews, currentUser.id]);

  // Reviews written/given by the current user
  const reviewsGiven = useMemo(() => {
    return reviews.filter(r => r.reviewerId === currentUser.id);
  }, [reviews, currentUser.id]);

  // Compute rating metrics
  const stats = useMemo(() => {
    if (reviewsReceived.length === 0) return { avg: 5.0, count: 0, distribution: [0, 0, 0, 0, 0] };
    const sum = reviewsReceived.reduce((acc, r) => acc + r.rating, 0);
    const avg = sum / reviewsReceived.length;
    
    const distribution = [0, 0, 0, 0, 0]; // 5 star down to 1 star
    reviewsReceived.forEach(r => {
      const idx = 5 - r.rating;
      if (idx >= 0 && idx < 5) distribution[idx]++;
    });

    return {
      avg: parseFloat(avg.toFixed(1)),
      count: reviewsReceived.length,
      distribution
    };
  }, [reviewsReceived]);

  const handlePostReview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess(false);

    if (!selectedPartnerId) {
      setFormError("Veuillez sélectionner un partenaire dans votre carnet d'adresses.");
      return;
    }
    if (!newComment.trim()) {
      setFormError("Veuillez rédiger un commentaire décrivant votre expérience de partenariat.");
      return;
    }

    const targetUser = users.find(u => u.id === selectedPartnerId);
    if (!targetUser) {
      setFormError("Le partenaire sélectionné n'existe pas.");
      return;
    }

    const newReview: PartnerReview = {
      id: "rev-" + Date.now(),
      reviewerId: currentUser.id,
      reviewerName: currentUser.name || "Partenaire Wakat",
      reviewerCompanyName: currentUser.companyName || "Commerce Wakat",
      reviewerRole: currentUser.role,
      targetId: targetUser.id,
      targetName: `${targetUser.name} (${targetUser.role === "WHOLESALER" ? "Grossiste" : targetUser.role === "SEMI_WHOLESALER" ? "Demi-Grossiste" : "Détaillant"})`,
      rating: newRating,
      comment: newComment.trim(),
      createdAt: new Date().toISOString()
    };

    const updated = [newReview, ...reviews];
    saveReviews(updated);

    setFormSuccess(true);
    setNewComment("");
    setSelectedPartnerId("");
    setNewRating(5);

    // Dynamic reset transition
    setTimeout(() => {
      setFormSuccess(false);
      setActiveTab("given");
    }, 2000);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "WHOLESALER": return "Grossiste";
      case "SEMI_WHOLESALER": return "Demi-Grossiste";
      case "RETAILER": return "Détaillant";
      case "MANUFACTURER": return "Producteur B2B";
      default: return "Partenaire";
    }
  };

  const filteredReviews = useMemo(() => {
    const list = activeTab === "received" ? reviewsReceived : reviewsGiven;
    return list.filter(r => {
      const matchesSearch = 
        r.reviewerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.comment.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRating = selectedRatingFilter === "all" ? true : r.rating === selectedRatingFilter;

      return matchesSearch && matchesRating;
    });
  }, [activeTab, reviewsReceived, reviewsGiven, searchQuery, selectedRatingFilter]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden" id="partner-reviews-tab-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-6 text-white relative">
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-15">
          <MessageSquare className="w-24 h-24 stroke-[1.5]" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <span className="bg-emerald-700/50 text-white font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-400/30">
            Confiance & Réputation B2B
          </span>
          <h3 className="text-xl font-extrabold mt-2 tracking-tight">Avis des Partenaires Commerciaux</h3>
          <p className="text-emerald-100 text-xs mt-1 leading-relaxed">
            Donnez et recevez des avis certifiés de vos partenaires grossistes, demi-grossistes et détaillants pour consolider la confiance au sein du réseau WakatMarket.
          </p>
        </div>
      </div>

      {/* Segmented Controls & Actions */}
      <div className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <button
            onClick={() => setActiveTab("received")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "received" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Avis Reçus ({reviewsReceived.length})
          </button>
          <button
            onClick={() => setActiveTab("given")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "given" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Avis Rédigés ({reviewsGiven.length})
          </button>
          <button
            onClick={() => setActiveTab("write")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "write" ? "bg-emerald-600 text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Donner un avis
          </button>
        </div>

        {activeTab !== "write" && (
          <div className="flex items-center gap-3 w-full sm:w-auto text-xs">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, commentaire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-medium"
              />
            </div>
            {/* Rating Filter */}
            <select
              value={selectedRatingFilter}
              onChange={(e) => setSelectedRatingFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl font-medium"
            >
              <option value="all">Toutes les notes</option>
              <option value="5">⭐⭐⭐⭐⭐ (5)</option>
              <option value="4">⭐⭐⭐⭐ (4)</option>
              <option value="3">⭐⭐⭐ (3)</option>
              <option value="2">⭐⭐ (2)</option>
              <option value="1">⭐ (1)</option>
            </select>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* TAB 1 & 2: LIST VIEWS */}
        {activeTab !== "write" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Stats Sidebar (Only when viewing received reviews) */}
            {activeTab === "received" && (
              <div className="lg:col-span-4 space-y-4">
                <div className="p-5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-500" /> Votre Note Globale
                  </h4>
                  
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-4xl font-extrabold font-mono text-zinc-900 dark:text-white leading-none">
                      {stats.avg}
                    </span>
                    <div className="space-y-1">
                      <div className="flex gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${s <= Math.round(stats.avg) ? "fill-current" : "text-zinc-200 dark:text-zinc-700"}`}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold">sur {stats.count} avis certifiés</p>
                    </div>
                  </div>

                  {/* Rating distribution bars */}
                  <div className="mt-5 space-y-2 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = stats.distribution[5 - stars];
                      const pct = stats.count > 0 ? (count / stats.count) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-10 text-right shrink-0">{stars} étoiles</span>
                          <div className="flex-1 h-2 bg-zinc-150 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right shrink-0">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 rounded-2xl space-y-2">
                  <div className="flex gap-2 items-start text-emerald-700 dark:text-emerald-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold leading-tight">Certifié par WakatMarket</h5>
                      <p className="text-[10px] opacity-90 mt-1 leading-relaxed">
                        Chaque avis provient directement d'un partenaire avec lequel vous êtes en relation contractuelle ou commerciale active.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Listing Area */}
            <div className={activeTab === "received" ? "lg:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
              {filteredReviews.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <MessageSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Aucun avis trouvé</p>
                  <p className="text-[10px] text-zinc-500 mt-1 max-w-sm mx-auto">
                    {searchQuery || selectedRatingFilter !== "all" 
                      ? "Modifiez vos filtres ou termes de recherche pour afficher d'autres avis."
                      : activeTab === "received" 
                        ? "Vous n'avez pas encore reçu d'avis de la part de vos partenaires." 
                        : "Vous n'avez pas encore rédigé d'avis pour vos partenaires."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredReviews.map((review) => (
                    <div 
                      key={review.id} 
                      className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition flex flex-col justify-between"
                    >
                      <div>
                        {/* Reviewer Header info */}
                        <div className="flex justify-between items-start gap-2 mb-2.5">
                          <div>
                            <h5 className="font-bold text-xs text-zinc-900 dark:text-white leading-tight">
                              {activeTab === "received" ? review.reviewerName : review.targetName}
                            </h5>
                            <span className="text-[9px] text-zinc-500 font-semibold mt-0.5 block flex items-center gap-1">
                              <Building className="w-3 h-3 inline text-zinc-400" />
                              {activeTab === "received" ? review.reviewerCompanyName : getRoleLabel(review.reviewerRole)}
                            </span>
                          </div>

                          {/* Star Rating display */}
                          <div className="flex gap-0.5 text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-lg border border-amber-100 dark:border-amber-900/30 font-mono text-[10px] font-extrabold items-center shrink-0">
                            <Star className="w-3 h-3 fill-current" />
                            <span>{review.rating}.0</span>
                          </div>
                        </div>

                        {/* Comment body */}
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 italic font-medium leading-relaxed mb-4">
                          "{review.comment}"
                        </p>
                      </div>

                      {/* Date footer */}
                      <div className="flex justify-between items-center text-[9px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-850 pt-2.5 mt-auto">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          Le {new Date(review.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-md font-extrabold uppercase text-[8px] tracking-wider">
                          Partenaire Certifié
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: WRITE REVIEW FORM */}
        {activeTab === "write" && (
          <form onSubmit={handlePostReview} className="max-w-2xl mx-auto space-y-6 text-xs">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-150 dark:border-zinc-800">
              Rédiger un nouvel avis de Partenariat
            </h4>

            {formSuccess ? (
              <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-2xl flex flex-col items-center text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <div>
                  <h5 className="font-extrabold text-sm">Avis enregistré avec succès !</h5>
                  <p className="text-xs opacity-90 mt-1">Merci pour votre retour. Vos partenaires apprécient grandement votre transparence commerciale.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-xl font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Select Partner */}
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1.5">
                    Sélectionnez un Partenaire Commercial *
                  </label>
                  {connectedPartners.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 rounded-xl font-medium">
                      Vous n'avez pas de relation commerciale active ou de partenaire dans votre réseau pour le moment. Allez sur le carnet d'adresses pour en ajouter.
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-bold cursor-pointer pr-10"
                        required
                      >
                        <option value="">-- Choisir un partenaire connecté --</option>
                        {connectedPartners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.username} ({getRoleLabel(p.role)}) {p.companyName ? ` - ${p.companyName}` : ""}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-500 text-[10px]">
                        ▼
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Rating Selector */}
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-2">
                    Note globale attribuée *
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <button
                        key={stars}
                        type="button"
                        onClick={() => setNewRating(stars)}
                        className={`p-3.5 border rounded-2xl transition cursor-pointer flex flex-col items-center justify-between w-20 ${
                          newRating === stars
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-extrabold"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600"
                        }`}
                      >
                        <Star className={`w-6 h-6 ${newRating >= stars ? "fill-current text-amber-400" : ""}`} />
                        <span className="text-[10px] mt-2 font-bold">{stars} / 5</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Comment Field */}
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1.5">
                    Commentaire détaillé de votre collaboration *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Décrivez brièvement la qualité du service, le respect des délais, la conformité des stocks ou la communication de ce partenaire..."
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium resize-none leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Conseil : Donnez un avis constructif et poli pour préserver d'excellentes relations d'affaires.
                  </p>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("received")}
                    className="px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition font-bold"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={connectedPartners.length === 0}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-xl shadow-lg transition font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <PenTool className="w-4 h-4" /> Publier l'Avis Certifié
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
