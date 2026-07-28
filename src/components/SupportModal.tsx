/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HelpCircle,
  LifeBuoy,
  Search,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  Send,
  Bot,
  FileText,
  PhoneCall,
  Mail,
  Zap,
  ShieldCheck,
  RefreshCw,
  ThumbsUp,
  Building2,
  ShoppingCart,
  CreditCard,
  WifiOff
} from "lucide-react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
}

interface FAQItem {
  id: string;
  category: "general" | "orders" | "roles" | "payments" | "offline";
  categoryLabel: string;
  question: string;
  answer: string;
  tags: string[];
  docRef: string;
}

const PLATFORM_DOCS_FAQ: FAQItem[] = [
  {
    id: "faq-1",
    category: "general",
    categoryLabel: "Général",
    question: "Qu'est-ce que WakatMarket et comment fonctionne la plateforme ?",
    answer: "WakatMarket est la plateforme intelligente d'interconnexion B2B et B2C pour la distribution en Afrique de l'Ouest. Elle relie numériquement les Fabricants/Usines, Grossistes, Demi-grossistes, Détaillants et Clients finaux. La plateforme centralise les catalogues, le suivi des stocks, la prise de commande, les crédits inter-entreprises et le point de vente (POS).",
    tags: ["Présentation", "Architecture", "Plateforme"],
    docRef: "Doc V1.2 - Ch.1 : Ingestion & Acteurs"
  },
  {
    id: "faq-2",
    category: "roles",
    categoryLabel: "Rôles & Partenariats",
    question: "Quels sont les rôles d'utilisateurs disponibles et leurs prérogatives ?",
    answer: "WakatMarket gère 6 rôles d'acteurs clés :\n1. FABRICANT / USINE : Gestion de la production, vente en très gros aux grossistes, fixation des prix de référence.\n2. GROSSISTE : Approvisionnement auprès des fabricants, vente aux demi-grossistes, gestion de flotte de distribution.\n3. DEMI-GROSSISTE : Achats auprès des grossistes, vente par cartons aux boutiques détaillantes.\n4. DÉTAILLANT : Achat aux demi-grossistes, vente aux clients finaux B2C via le POS (Point de Vente).\n5. LIVREUR : Réception des missions de livraison et validation par code OTP.\n6. CLIENT : Achats au détail auprès des boutiques locales.",
    tags: ["Rôles", "Habilitations", "Acteurs"],
    docRef: "Doc V1.2 - Ch.2 : Matrice des habilitations ERP"
  },
  {
    id: "faq-3",
    category: "orders",
    categoryLabel: "Commandes & Stocks",
    question: "Comment effectuer une commande d'approvisionnement B2B auprès d'un fournisseur ?",
    answer: "Pour passer une commande B2B :\n1. Accédez à l'onglet 'Approvisionnement' ou 'Achats Gros' dans votre tableau de bord.\n2. Sélectionnez votre fournisseur agréé parmi vos partenaires connectés.\n3. Ajoutez les articles au panier d'approvisionnement.\n4. Choisissez les modalités de paiement (Comptant ou Crédit B2B).\n5. Confirmez l'envoi de la commande. Votre fournisseur recevra immédiatement la notification pour la valider et planifier la livraison.",
    tags: ["Approvisionnement", "Commandes", "Achats"],
    docRef: "Doc V1.2 - Ch.3 : Workflow de commande B2B"
  },
  {
    id: "faq-4",
    category: "payments",
    categoryLabel: "Paiements & Crédits B2B",
    question: "Comment fonctionne l'octroi de crédit B2B et l'échéancier des paiements ?",
    answer: "Les fournisseurs (Fabricants, Grossistes, Demi-grossistes) peuvent attribuer une limite de crédit personnalisée à leurs acheteurs de confiance. Lors d'une commande à crédit :\n- Le solde de la dette est automatiquement mis à jour.\n- L'acheteur peut régler sa dette en plusieurs versements (Paiement Partiel) via l'interface 'Gestion des Créances'.\n- Un reçu numérique est généré à chaque remboursement.",
    tags: ["Crédit B2B", "Créances", "Dette", "Paiement Partiel"],
    docRef: "Doc V1.2 - Ch.4 : Module de gestion financière & dettes"
  },
  {
    id: "faq-5",
    category: "offline",
    categoryLabel: "Mode Hors-Ligne (Offline)",
    question: "Que se passe-t-il si je perds la connexion Internet lors d'une vente ou commande ?",
    answer: "WakatMarket intègre un moteur de synchronisation autonome PWA. Si vous perdez la connexion :\n1. Le système bascule automatiquement en mode Offline.\n2. Vous pouvez continuer à enregistrer vos ventes au comptoir (POS) et ajuster vos stocks locaux.\n3. Vos transactions sont stockées dans la file d'attente sécurisée locale (`SyncQueue`).\n4. Dès le rétablissement de la connexion, les données sont automatiquement synchronisées avec le serveur.",
    tags: ["Offline", "Sync", "File d'attente", "PWA"],
    docRef: "Doc V1.2 - Ch.5 : Moteur de resynchronisation distribué"
  },
  {
    id: "faq-6",
    category: "orders",
    categoryLabel: "Commandes & Stocks",
    question: "Comment utiliser le scanner de code-barres pour les inventaires et ventes ?",
    answer: "Cliquez sur le bouton 'Scanner Code-barres' dans la barre d'en-tête supérieure. Vous pouvez utiliser la caméra de votre smartphone/PC ou un lecteur optique. Le scanner recherche instantanément le produit dans la base de données WakatMarket pour remplir le panier de vente ou incrémenter l'inventaire.",
    tags: ["Code-barres", "Scanner", "POS"],
    docRef: "Doc V1.2 - Ch.6 : Périphériques & Matériel POS"
  },
  {
    id: "faq-7",
    category: "general",
    categoryLabel: "Général",
    question: "Comment sécuriser la réception des livraisons avec le code OTP ?",
    answer: "Lorsqu'une commande est expédiée avec un livreur, un code OTP à 4 chiffres est transmis au destinataire. Le livreur ne peut clôturer la livraison que si le destinataire lui fournit le code OTP correct. Cela garantit qu'aucune marchandise ne peut être déclarée livrée à tort.",
    tags: ["OTP", "Livraison", "Sécurité"],
    docRef: "Doc V1.2 - Ch.7 : Protocole de preuve de livraison (PoD)"
  },
  {
    id: "faq-8",
    category: "roles",
    categoryLabel: "Rôles & Partenariats",
    question: "Comment lier de nouveaux partenaires commercialement (Demande de partenariat) ?",
    answer: "Allez dans l'onglet 'Partenaires' ou 'Gestion des Relations'. Utilisez la barre de recherche pour trouver l'entreprise souhaitée par son nom ou son quartier/ville, puis cliquez sur 'Demander une connexion commercial'. Une fois acceptée par l'autre partie, les tarifs négociés et catalogues deviennent accessibles.",
    tags: ["Partenariat", "Relations", "Interconnexion"],
    docRef: "Doc V1.2 - Ch.8 : Réseau B2B & Relations"
  }
];

export default function SupportModal({ isOpen, onClose, userRole, userName }: SupportModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>("faq-1");
  const [helpfulFeedback, setHelpfulFeedback] = useState<Record<string, boolean>>({});

  // AI Interactive Question state
  const [aiQuestion, setAiQuestion] = useState<string>("");
  const [aiAnswer, setAiAnswer] = useState<{ question: string; answer: string; sources: string[] } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // Filtered FAQ items
  const filteredFAQs = useMemo(() => {
    return PLATFORM_DOCS_FAQ.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Handle AI question generation based on documentation
  const handleAskAI = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiQuestion.trim()) return;

    setIsAiThinking(true);
    setAiAnswer(null);

    const query = aiQuestion.toLowerCase();

    setTimeout(() => {
      let generatedText = "";
      let matchedSources = ["Documentation Officielle WakatMarket v1.2", "Manuel des Opérations ERP B2B/B2C"];

      if (query.includes("commande") || query.includes("acheter") || query.includes("panier")) {
        generatedText = `Selon la documentation WakatMarket (Section Commandes B2B/B2C) :\n\n• Pour passer une commande d'approvisionnement B2B, rendez-vous sur l'onglet 'Approvisionnement', sélectionnez votre fournisseur agréé, puis ajoutez les références par cartons ou palettes.\n• Le système calcule automatiquement le prix selon votre grille tarifaire négociée.\n• Les commandes enregistrées déclenchent un suivi en temps réel avec notification instantanée.`;
        matchedSources.push("Guide Pratique : Passer et traiter une commande B2B");
      } else if (query.includes("credit") || query.includes("crédit") || query.includes("dette") || query.includes("payer") || query.includes("echeance")) {
        generatedText = `Selon la documentation WakatMarket (Section Gestion Financière) :\n\n• Le paiement à crédit est accordé par les fournisseurs selon une limite mensuelle définie.\n• Les remboursements partiels ou totaux s'effectuent directement depuis l'onglet 'Finances & Créances'.\n• Chaque versement met à jour le solde restant et libère le plafond d'encours de l'acheteur.`;
        matchedSources.push("Politique des Crédits & Encours B2B");
      } else if (query.includes("offline") || query.includes("connexion") || query.includes("internet") || query.includes("sync")) {
        generatedText = `Selon la documentation WakatMarket (Section Architecture PWA & Offline) :\n\n• WakatMarket fonctionne à 100% sans connexion Internet continue.\n• Toutes vos ventes au comptoir (POS) et entrées/sorties de stock sont mémorisées localement.\n• Dès que votre appareil retrouve le réseau, la synchronisation sécurisée s'exécute automatiquement en arrière-plan sans perte de données.`;
        matchedSources.push("Protocole de Synchronisation Distribuée");
      } else if (query.includes("livraison") || query.includes("livreur") || query.includes("otp") || query.includes("code")) {
        generatedText = `Selon la documentation WakatMarket (Section Logistique & Delivery) :\n\n• Chaque expédition génère un code OTP unique à 4 chiffres sur le compte de l'acheteur.\n• À la réception physique du stock, l'acheteur fournit ce code au livreur.\n• La saisie de l'OTP valide la confirmation de livraison et transfère la propriété du stock.`;
        matchedSources.push("Procédure de Sécurité des Livraisons OTP");
      } else {
        generatedText = `D'après la documentation globale de WakatMarket :\n\nConcernant votre question (« ${aiQuestion} ») :\n• La plateforme est conçue pour simplifier les flux de distribution entre Fabricants, Grossistes, Demi-grossistes et Détaillants.\n• Vous pouvez réaliser vos opérations quotidiennes (ventes, achats, inventaires, paiements) directement via les onglets dédiés à votre rôle (${userRole || "Utilisateur"}).\n• Pour une assistance directe par un conseiller humain, vous pouvez également utiliser le bouton WhatsApp Support ci-dessous.`;
        matchedSources.push("Base de Connaissances Générale WakatMarket");
      }

      setAiAnswer({
        question: aiQuestion,
        answer: generatedText,
        sources: matchedSources
      });
      setIsAiThinking(false);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          id="support-modal-container"
        >
          {/* Header Bar */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-900 via-zinc-900 to-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-inner">
                <LifeBuoy className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> IA Support & Documentation
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
                  Centre d'Aide & FAQ Intelligente
                </h2>
                <p className="text-xs text-zinc-300 hidden sm:block">
                  Réponses instantanées basées sur la documentation officielle WakatMarket
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer relative z-10"
              id="close-support-modal-btn"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & AI Question Prompt */}
          <div className="p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
            {/* AI Custom Question Box */}
            <form onSubmit={handleAskAI} className="relative">
              <div className="bg-white dark:bg-zinc-900 p-2 sm:p-2.5 rounded-2xl border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/5 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="flex items-center gap-2 px-2 flex-grow">
                  <Bot className="w-5 h-5 text-emerald-500 flex-shrink-0 animate-pulse" />
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Posez une question spécifique sur la plateforme (ex: Comment gérer les crédits B2B ?)..."
                    className="w-full text-xs font-medium bg-transparent border-none outline-none text-zinc-900 dark:text-white placeholder-zinc-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAiThinking || !aiQuestion.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer flex-shrink-0"
                >
                  {isAiThinking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyse IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Générer Réponse IA</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* AI Generated Response Card if present */}
            {aiAnswer && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-emerald-900/90 to-zinc-900 text-white p-5 rounded-2xl border border-emerald-500/40 shadow-xl space-y-3"
              >
                <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      Réponse IA Générée sur Mesure
                    </span>
                  </div>
                  <button
                    onClick={() => setAiAnswer(null)}
                    className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Effacer
                  </button>
                </div>
                <div className="text-xs text-zinc-100 whitespace-pre-line leading-relaxed font-sans">
                  {aiAnswer.answer}
                </div>
                <div className="pt-2 border-t border-emerald-800/40 flex flex-wrap items-center gap-2 text-[10px] text-zinc-300">
                  <span className="font-bold text-emerald-400">Sources vérifiées :</span>
                  {aiAnswer.sources.map((src, i) => (
                    <span key={i} className="bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-700/50">
                      {src}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Search and Category Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-grow max-w-md">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher dans la FAQ..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
                {[
                  { id: "all", label: "Tout", icon: BookOpen },
                  { id: "general", label: "Général", icon: HelpCircle },
                  { id: "orders", label: "Commandes", icon: ShoppingCart },
                  { id: "roles", label: "Rôles", icon: Building2 },
                  { id: "payments", label: "Finances", icon: CreditCard },
                  { id: "offline", label: "Offline", icon: WifiOff }
                ].map((cat) => {
                  const IconComponent = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      }`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Main Content Area - Scrollable */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-grow">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                Questions Fréquentes de la Documentation ({filteredFAQs.length})
              </h3>
            </div>

            {filteredFAQs.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 space-y-2">
                <HelpCircle className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Aucun résultat trouvé pour votre recherche.
                </p>
                <p className="text-[11px] text-zinc-500">
                  Essayez avec un autre mot-clé ou posez directement votre question dans la boîte IA ci-dessus.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFAQs.map((faq) => {
                  const isExpanded = expandedId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className={`border rounded-2xl transition duration-200 overflow-hidden ${
                        isExpanded
                          ? "bg-white dark:bg-zinc-900 border-emerald-500/50 shadow-md"
                          : "bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      {/* Accordion Header */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                        className="w-full p-4 text-left flex items-start justify-between gap-3 cursor-pointer"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                              {faq.categoryLabel}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {faq.docRef}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                            {faq.question}
                          </h4>
                        </div>
                        <div className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex-shrink-0 mt-0.5">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* Accordion Body */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 space-y-3"
                        >
                          <div className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed bg-zinc-50 dark:bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            {faq.answer}
                          </div>

                          {/* Tags & Feedback */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {faq.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-medium"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            <button
                              onClick={() =>
                                setHelpfulFeedback((prev) => ({
                                  ...prev,
                                  [faq.id]: !prev[faq.id]
                                }))
                              }
                              className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                                helpfulFeedback[faq.id]
                                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{helpfulFeedback[faq.id] ? "Utile !" : "Utile ?"}</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Platform Quick Direct Support Section */}
            <div className="mt-6 p-4 sm:p-5 bg-gradient-to-r from-zinc-900 to-zinc-950 text-white rounded-2xl border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    Besoin d'une Assistance Humaine Directe ?
                  </h4>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Support 24/7 Disponible
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Nos équipes techniques et opérationnelles accompagnent les entreprises en Côte d'Ivoire, au Burkina Faso et dans toute la sous-région.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <a
                  href="https://wa.me/22600000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Support</span>
                </a>
                <a
                  href="mailto:support@wakatmarket.com"
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>support@wakatmarket.com</span>
                </a>
                <div className="p-2.5 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                  <PhoneCall className="w-4 h-4 text-emerald-400" />
                  <span>+226 25 30 00 00</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
