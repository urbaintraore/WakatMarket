import React, { useState, useEffect } from "react";
import { 
  Compass, CheckCircle, ChevronRight, ChevronLeft, X, Sparkles, 
  ShoppingBag, CreditCard, Users, BarChart3, Bell, ShieldCheck,
  Package, HelpCircle, AlertTriangle, ArrowRight
} from "lucide-react";
import { UserProfile, UserRole } from "../types";

interface TourStep {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  highlights: string[];
  tip?: string;
  targetId?: string;
}

interface OnboardingTourProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function OnboardingTour({ currentUser, isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Role-aware title
  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.MANUFACTURER: return "Fabricant / Industrielle";
      case UserRole.WHOLESALER: return "Grand Grossiste";
      case UserRole.SEMI_WHOLESALER: return "Demi-Grossiste";
      case UserRole.RETAILER: return "Boutique / Détaillant";
      case UserRole.DRIVER_M2W:
      case UserRole.DRIVER_W2R:
      case UserRole.DRIVER_R2C: return "Livreur Logistique";
      case UserRole.CLIENT: return "Acheteur Final / Client";
      default: return "Partenaire";
    }
  };

  // Define steps tailored for WakatMarket
  const steps: TourStep[] = [
    {
      id: "welcome",
      title: `Bienvenue sur WakatMarket !`,
      subtitle: `Plateforme de Distribution & Logistique Intelligente d'Afrique`,
      badge: getRoleLabel(currentUser.role),
      description: `WakatMarket numérise votre chaîne d'approvisionnement B2B et B2C. Découvrez rapidement comment tirer le meilleur parti de votre espace de travail intelligent.`,
      icon: Compass,
      highlights: [
        "Gestion simplifiée des ventes au comptant et à crédit (Ardoise)",
        "Suivi du stock en temps réel avec alertes de seuil critique",
        "Paiements mobiles (Orange Money, Moov Money, Wave) et suivi des dettes",
        "Fonctionnement 100% hors-ligne avec synchronisation automatique"
      ],
      tip: "Vous pouvez relancer cette visite guidée à tout moment depuis le bouton 'Visite Guidée' en haut de l'écran."
    },
    {
      id: "dashboard",
      title: "Tableau de Bord & Indicateurs Clés",
      subtitle: "Pilotage financier et opérationnel en temps réel",
      badge: "Indicateurs KPIs",
      description: "Visualisez en un coup d'œil vos chiffres de vente, créances globales, état du stock et activité récente grâce à une interface adaptée à votre rôle.",
      icon: BarChart3,
      targetId: "kpi-overview",
      highlights: [
        "Chiffre d'affaires journalier et mensuel",
        "Somme totale des dettes et créances à recouvrir",
        "Alertes de stock faible et produits sous le seuil critique",
        "Nombre de commandes en attente de livraison"
      ]
    },
    {
      id: "caisse",
      title: "Module Caisse & Point de Vente (POS)",
      subtitle: "Encaissement rapide & Facturation PDF conforme",
      badge: "Ventes & Caisse",
      description: "Enregistrez vos ventes comptant ou à crédit en quelques secondes. Sélectionnez vos clients habituels, appliquez la limite de crédit et imprimez ou téléchargez les factures.",
      icon: ShoppingBag,
      targetId: "caisse-module",
      highlights: [
        "Ventes au comptant (CASH, Mobile Money) ou à crédit (Ardoise)",
        "Vérification automatique de la jauge de crédit de l'acheteur",
        "Génération instantanée de factures PDF officielles",
        "Notifications sonores de confirmation de paiement"
      ]
    },
    {
      id: "buyers",
      title: "Mes Acheteurs & Suivi des Dettes",
      subtitle: "Fiche signalétique, Jauge de crédit & Règlements partiels",
      badge: "Gestion Clientèle",
      description: "Consultez la fiche détaillée de chaque client, suivez l'encours de ses dettes, ajustez ses plafonds de crédit et enregistrez des règlements partiels pour chaque facture spécifique.",
      icon: Users,
      targetId: "my-buyers-module",
      highlights: [
        "Fiche signalétique complète (Coordonnées, statut, bilan financier)",
        "Jauge de crédit visuelle avec indicateur de risque (Vert/Orange/Rouge)",
        "Historique des factures et suivi précis des impayés",
        "Formulaire de saisie de règlements partiels par facture"
      ]
    },
    {
      id: "inventory",
      title: "Stock & Analyse des Prix Recharts",
      subtitle: "Suivi des mouvements & Historique des prix sur 30 jours",
      badge: "Inventaire & Prix",
      description: "Maintenez un contrôle parfait sur votre inventaire. Suivez les entrées/sorties et analysez l'historique des prix sur 30 jours grâce aux graphiques Recharts interactifs.",
      icon: Package,
      targetId: "inventory-section",
      highlights: [
        "Graphique Recharts d'évolution du prix de vente vs prix d'achat",
        "Entrées (IN), sorties (OUT) et réajustements de stock",
        "Propositions intelligentes de rechargement de stock",
        "Catégorisation par marque et emballage (Carton, Sac, Unité)"
      ]
    },
    {
      id: "push",
      title: "Notifications Push & Sync Hors-Ligne",
      subtitle: "Restez informé instantanément où que vous soyez",
      badge: "Alertes Web Push",
      description: "Activez les notifications push du navigateur pour recevoir des alertes sonores dès qu'un paiement est encaissé ou qu'un produit atteint un niveau de stock critique.",
      icon: Bell,
      highlights: [
        "Alertes sonores en cas de paiement encaissé ou d'acompte reçu",
        "Alertes immédiates en cas de stock critique sous le seuil",
        "Sauvegarde locale permanente en cas de coupure réseau",
        "Synchronisation transparente avec Firebase au retour de la connexion"
      ]
    }
  ];

  if (!isOpen) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(`wakat_onboarding_completed_${currentUser.id}`, "true");
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all">
        
        {/* Header decoration bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500" />

        {/* Top bar with close button & progress */}
        <div className="p-4 sm:p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-300/40">
              {step.badge}
            </span>
            <span className="text-xs font-bold text-zinc-400">
              Étape {currentStep + 1} / {steps.length}
            </span>
          </div>

          <button
            onClick={handleComplete}
            className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
            title="Fermer la visite guidée"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Main title & icon */}
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <StepIcon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-snug">
                {step.title}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {step.subtitle}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal">
            {step.description}
          </p>

          {/* Key highlights list */}
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Fonctionnalités Clés
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {step.highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tip callout */}
          {step.tip && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{step.tip}</span>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === currentStep
                    ? "w-6 bg-emerald-500"
                    : "w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400"
                }`}
                title={`Aller à l'étape ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wide shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isLast ? "Terminer la visite" : "Suivant"}</span>
              {isLast ? <CheckCircle className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
