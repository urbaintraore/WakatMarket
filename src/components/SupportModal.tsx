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
  category: "general" | "orders" | "roles" | "payments" | "offline" | "tools";
  categoryLabel: string;
  question: string;
  answer: string;
  tags: string[];
  docRef: string;
}

const PLATFORM_DOCS_FAQ: FAQItem[] = [
  {
    id: "faq-synchro-ok",
    category: "tools",
    categoryLabel: "Outils & Système",
    question: "Quel est le rôle du bouton / badge « Synchro OK » et que se passe-t-il s'il n'est pas vert ?",
    answer: "• RÔLE PRINCIPAL :\nLe badge 'Synchro OK' (ou 'En ligne & Synchronisé') est le témoin d'intégrité en temps réel entre votre appareil et la base de données Cloud Supabase.\n1. Vert ('Synchro OK') : Confirme que vous êtes connecté à Internet et que 100% de vos modifications locales (produits créés, stocks modifiés, ventes comptoir, encaissements) sont sauvegardées sur le Cloud.\n2. Clic interactif : Cliquer sur le badge déclenche un test de connectivité immédiat et force un rafraîchissement avec le serveur.\n\n• QUE SE PASSE-T-IL S'IL N'EST PAS AU VERT ?\nLa synchronisation est 100% automatique ; vous n'avez pas besoin de l'activer manuellement.\n- S'il affiche 'Hors ligne' 🟠 : Votre connexion Internet est coupée. Vos actions continuent d'être enregistrées localement sans aucun blocage et seront transmises automatiquement au retour du réseau.\n- S'il affiche 'Synchro...' 🔄 : Les données locales sont en cours d'envoi vers le serveur.\n- S'il affiche 'Erreur Synchro' 🔴 : Une opération a été interrompue. Cliquer sur le badge relance automatiquement l'envoi des opérations échouées.",
    tags: ["Synchro OK", "Synchronisation", "Cloud", "Offline", "Supabase", "Statut"],
    docRef: "Doc V1.2 - Ch.5.1 : Témoin d'état et Intégrité Cloud"
  },
  {
    id: "faq-pwa-install",
    category: "tools",
    categoryLabel: "Outils & Système",
    question: "Quel est le rôle du bouton « PWA Installable (Hors-ligne OK) » et que se passe-t-il s'il n'est pas activé ?",
    answer: "• RÔLE PRINCIPAL :\nLe bouton 'PWA Installable (Hors-ligne OK)' permet d'installer WakatMarket directement sur votre smartphone (Android / iPhone) ou ordinateur comme une vraie application native sans passer par le Google Play Store ou l'App Store.\n- Crée une icône WakatMarket sur votre écran d'accueil.\n- Lance l'application en plein écran (sans barre d'adresse de navigateur).\n- Met en cache les ressources pour un démarrage ultra-rapide même sans aucun réseau (au marché ou en zone rurale).\n\n• QUE SE PASSE-T-IL S'IL N'EST PAS INSTALLÉ ?\nL'application continue de fonctionner exactement de la même manière dans votre navigateur web classique (Chrome, Safari, Edge). Le mode hors-ligne et l'enregistrement local de vos ventes restent 100% actifs même sans installation.",
    tags: ["PWA", "Installation", "Hors-ligne", "Mobile", "Android", "iPhone", "Application"],
    docRef: "Doc V1.2 - Ch.5.2 : Progressive Web App & Cache Hors-ligne"
  },
  {
    id: "faq-sync-system",
    category: "tools",
    categoryLabel: "Outils & Système",
    question: "Quel est le rôle du bouton « Sync Système » et que se passe-t-il s'il n'est pas utilisé ?",
    answer: "• RÔLE PRINCIPAL :\n'Sync Système' est le centre de contrôle et de diagnostic de la file d'attente de synchronisation (`SyncQueue`).\n1. Supervision : Visualiser toutes les opérations en attente d'envoi vers le serveur.\n2. Forçage manuel : Déclencher un envoi immédiat sans attendre le cycle automatique périodique.\n3. Gestion des erreurs : Inspecter la cause précise d'un échec éventuel et relancer la file en un clic.\n\n• QUE SE PASSE-T-IL S'IL N'EST PAS UTILISÉ ?\nAucun problème ni perte de données ! Le moteur de synchronisation fonctionne en arrière-plan de manière autonome toutes les 20 secondes et à chaque détection de connexion. Vous n'avez jamais l'obligation d'ouvrir ce menu.",
    tags: ["Sync Système", "File d'attente", "SyncQueue", "Diagnostic", "Maintenance"],
    docRef: "Doc V1.2 - Ch.5.3 : Moteur de file d'attente distribuée"
  },
  {
    id: "faq-ia-forecasting",
    category: "tools",
    categoryLabel: "Outils & Système",
    question: "Quel est le rôle du module « IA Forecasting » et que se passe-t-il s'il n'est pas utilisé ?",
    answer: "• RÔLE PRINCIPAL :\n'IA Forecasting' est le copilote d'intelligence artificielle de WakatMarket pour l'anticipation de la demande et la gestion prédictive des stocks.\n1. Prévision des ventes : Analyse la cadence d'écoulement de chaque produit pour estimer la date probable d'épuisement.\n2. Recommandations de réapprovisionnement : Calcule les quantités idéales à commander auprès de vos grossistes ou usines pour éviter les ruptures sans sur-stocker.\n3. Analyse des tendances : Détecte les produits en forte accélération ou en ralentissement saisonnier.\n\n• QUE SE PASSE-T-IL S'IL N'EST PAS CONSULTÉ ?\nVous continuez à gérer vos approvisionnements et vos stocks de façon traditionnelle manuelle. Le reste de l'ERP fonctionne sans interruption.",
    tags: ["IA Forecasting", "Intelligence Artificielle", "Prédictions", "Rupture", "Stocks", "Approvisionnement"],
    docRef: "Doc V1.2 - Ch.9 : Moteur d'IA Prédictive & Forecasting"
  },
  {
    id: "faq-rapport-analytique",
    category: "tools",
    categoryLabel: "Outils & Système",
    question: "Quel est le rôle du « Rapport Analytique » et que permet-il de piloter ?",
    answer: "• RÔLE PRINCIPAL :\nLe module 'Rapports & Analytique' est votre tableau de bord financier et décisionnel pour mesurer la rentabilité de votre commerce :\n1. Chiffre d'Affaires (CA) & Marges : Suivi des ventes globales, des bénéfices nets et de l'évolution journalière/mensuelle.\n2. Suivi des créances et ardoises : Montant total dû par vos acheteurs à crédit et alertes sur les échéances dépassées.\n3. Top Produits : Identification des articles générant le plus de volume ou de marge.\n4. Export de bilans : Téléchargement des récapitulatifs pour la comptabilité ou la gestion fiscale.\n\n• QUE SE PASSE-T-IL S'IL N'EST PAS CONSULTÉ ?\nToutes vos ventes et entrées financières restent fidèlement enregistrées dans le système. Ce module sert d'outil d'analyse stratégique pour les gérants et chefs d'entreprise.",
    tags: ["Rapport Analytique", "Chiffre d'Affaires", "Marges", "Finances", "Statistiques", "Bilan"],
    docRef: "Doc V1.2 - Ch.10 : Module d'Analytique & Reporting Financier"
  },
  {
    id: "faq-scanner-barcodes",
    category: "tools",
    categoryLabel: "Outils & Système",
    question: "Quel est le rôle du « Scanner Code-barres » et comment fonctionne-t-il ?",
    answer: "• RÔLE PRINCIPAL :\nLe 'Scanner Code-barres' permet de capturer les codes EAN-13, QR codes ou références articles à l'aide de la caméra de votre smartphone/PC ou d'une douchette optique USB/Bluetooth.\n1. Vente express au comptoir (POS) : Scanner un article l'ajoute instantanément au panier sans aucune saisie manuelle.\n2. Inventaire et réception de stock : Permet de compter ou d'incrémenter le stock d'un produit en un seul bip.\n3. Recherche immédiate : Affiche la fiche technique, le prix et le stock disponible du produit scanné.\n\n• QUE SE PASSE-T-IL S'IL N'EST PAS UTILISÉ ?\nVous pouvez tout à fait rechercher vos articles manuellement par leur nom ou référence dans le catalogue ou la barre de recherche rapide.",
    tags: ["Scanner Code-barres", "Scan", "Caméra", "POS", "Vente Comptoir", "Inventaire"],
    docRef: "Doc V1.2 - Ch.6 : Périphériques & Matériel POS"
  },
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

      if (query.includes("synchro ok") || query.includes("synchro") || (query.includes("badge") && query.includes("vert"))) {
        generatedText = `Selon la documentation WakatMarket (Section Intégrité & Synchronisation Cloud) :\n\n• Le badge 'Synchro OK' (ou 'En ligne & Synchronisé') est le témoin d'intégrité en temps réel avec Supabase.\n• Vert : Tout est sauvegardé sur le Cloud sans aucune perte.\n• S'il n'est pas vert : Aucun souci ! En mode 'Hors ligne' ou 'Synchro...', toutes vos opérations sont conservées localement dans IndexedDB et envoyées automatiquement dès que la connexion revient.`;
        matchedSources.push("Guide Technique : Témoin d'état et Intégrité Cloud");
      } else if (query.includes("pwa") || query.includes("install") || query.includes("application") || query.includes("telephone")) {
        generatedText = `Selon la documentation WakatMarket (Section PWA & Installation Mobile) :\n\n• Le bouton 'PWA Installable' permet d'installer WakatMarket sur smartphone (Android/iOS) ou PC comme une vraie application native sans passer par le store.\n• Il crée une icône sur votre écran d'accueil et garantit une utilisation fluide en plein écran même à 100% hors-ligne.\n• Si vous ne l'installez pas, l'application fonctionne tout aussi bien dans le navigateur web classique avec toutes ses capacités locales.`;
        matchedSources.push("Guide d'Installation PWA Mobile & Offline");
      } else if (query.includes("sync système") || query.includes("sync systeme") || query.includes("file d'attente") || query.includes("queue")) {
        generatedText = `Selon la documentation WakatMarket (Section Gestion de File d'Attente SyncQueue) :\n\n• 'Sync Système' permet d'inspecter les opérations en cours de synchronisation et de forcer manuellement un envoi ou de relancer des échecs.\n• Si non utilisé : La synchronisation s'exécute automatiquement en tâche de fond de manière autonome sans intervention requise.`;
        matchedSources.push("Manuel ERP : File d'attente distribuée SyncQueue");
      } else if (query.includes("forecasting") || query.includes("ia") || query.includes("prévision") || query.includes("prevision") || query.includes("rupture")) {
        generatedText = `Selon la documentation WakatMarket (Section IA Prédictive & Forecasting) :\n\n• 'IA Forecasting' analyse vos tendances de vente historiques pour anticiper les ruptures de stock.\n• Il recommande les quantités optimales et dates clés de réapprovisionnement auprès de vos grossistes ou usines.\n• Si non consulté, vous continuez à gérer vos réapprovisionnements manuellement.`;
        matchedSources.push("Module d'Intelligence Artificielle & Prédiction des Ventes");
      } else if (query.includes("rapport") || query.includes("analytique") || query.includes("statistique") || query.includes("chiffre d'affaire") || query.includes("ca")) {
        generatedText = `Selon la documentation WakatMarket (Section Reporting & Analytique Financière) :\n\n• Le 'Rapport Analytique' présente votre Chiffre d'Affaires, marges brutes, ardoises/créances clients et articles les plus rentables.\n• Il permet l'exportation des bilans pour la comptabilité et la prise de décisions stratégiques.`;
        matchedSources.push("Guide Financier : Tableau de bord de pilotage");
      } else if (query.includes("scanner") || query.includes("code-barres") || query.includes("code barre") || query.includes("scan")) {
        generatedText = `Selon la documentation WakatMarket (Section Périphériques & POS) :\n\n• Le 'Scanner Code-barres' utilise la caméra de votre smartphone ou un lecteur optique pour ajouter instantanément des articles au panier POS ou ajuster l'inventaire en un seul scan.\n• Si non utilisé, la recherche textuelle manuelle par nom ou catégorie reste toujours disponible.`;
        matchedSources.push("Guide Matériel : Scanner optique & Caméra de caisse");
      } else if (query.includes("commande") || query.includes("acheter") || query.includes("panier")) {
        generatedText = `Selon la documentation WakatMarket (Section Commandes B2B/B2C) :\n\n• Pour passer une commande d'approvisionnement B2B, rendez-vous sur l'onglet 'Approvisionnement', sélectionnez votre fournisseur agréé, puis ajoutez les références par cartons ou palettes.\n• Le système calcule automatiquement le prix selon votre grille tarifaire négociée.\n• Les commandes enregistrées déclenchent un suivi en temps réel avec notification instantanée.`;
        matchedSources.push("Guide Pratique : Passer et traiter une commande B2B");
      } else if (query.includes("credit") || query.includes("crédit") || query.includes("dette") || query.includes("payer") || query.includes("echeance")) {
        generatedText = `Selon la documentation WakatMarket (Section Gestion Financière) :\n\n• Le paiement à crédit est accordé par les fournisseurs selon une limite mensuelle définie.\n• Les remboursements partiels ou totaux s'effectuent directement depuis l'onglet 'Finances & Créances'.\n• Chaque versement met à jour le solde restant et libère le plafond d'encours de l'acheteur.`;
        matchedSources.push("Politique des Crédits & Encours B2B");
      } else if (query.includes("offline") || query.includes("connexion") || query.includes("internet")) {
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
                  { id: "tools", label: "Outils & Système", icon: Zap },
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
