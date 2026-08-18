import React, { useState, useEffect } from "react";
import { 
  Compass, ChevronLeft, ChevronRight, Play, Pause, TrendingUp, 
  Target, Users, ShieldCheck, DollarSign, Globe, Sparkles, 
  Briefcase, LineChart, Award, Smartphone, Database, CheckCircle, Zap
} from "lucide-react";
import { formatCFA } from "../data";

interface PitchDeckProps {
  onClose: () => void;
}

export default function PitchDeck({ onClose }: PitchDeckProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const slides = [
    {
      title: "WakatMarket d'Afrique de l'Ouest",
      subtitle: "Pitch Deck Investisseur • Série Seed",
      badge: "Vision Globale",
      icon: Compass,
      bgColor: "from-emerald-900 to-zinc-950",
      content: (
        <div className="space-y-6 text-center py-4">
          <p className="text-sm text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
            La Révolution B2B Distribution & Fintech
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight max-w-2xl mx-auto">
            La première plateforme d'approvisionnement et de gestion de crédit pour la distribution en Afrique de l'Ouest
          </h2>
          <p className="text-zinc-300 text-xs md:text-sm max-w-lg mx-auto leading-relaxed">
            WakatMarket digitalise la chaîne logistique traditionnelle et sécurise l'encours de crédit client (l'ardoise) entre fabricants, grossistes et détaillants.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Marché Cible</p>
              <p className="text-lg font-black text-white mt-0.5">$400B+</p>
              <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">Commerce informel</p>
            </div>
            <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Technologie</p>
              <p className="text-lg font-black text-emerald-400 mt-0.5">Offline-First</p>
              <p className="text-[9px] text-emerald-500/80 font-bold mt-0.5">Sync Supabase</p>
            </div>
            <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Innovation</p>
              <p className="text-lg font-black text-amber-400 mt-0.5">Credit Scoring</p>
              <p className="text-[9px] text-amber-500/80 font-bold mt-0.5">Risque sous contrôle</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Le Problème",
      subtitle: "L'ardoise manuelle et le chaos logistique",
      badge: "Points de friction",
      icon: Target,
      bgColor: "from-rose-950 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white leading-snug">
              Pourquoi la distribution traditionnelle est en panne d'efficacité
            </h3>
            <p className="text-zinc-300 text-xs leading-relaxed">
              En Afrique de l'Ouest, plus de 90% de la vente au détail passe par des canaux informels. Les acteurs de cette chaîne souffrent de barrières structurelles :
            </p>
            <div className="space-y-2.5">
              {[
                { title: "Opacité de l'ardoise (Crédit)", desc: "Les crédits accordés aux acheteurs sont consignés sur de simples cahiers, entraînant pertes, disputes et impayés." },
                { title: "Déconnexion logistique", desc: "Les fabricants de boissons et d'agro-alimentaire n'ont aucune visibilité sur les stocks réels de leurs grossistes." },
                { title: "Ruptures de stocks critiques", desc: "Le manque d'outils analytiques proactifs provoque des ruptures qui coûtent jusqu'à 15% du chiffre d'affaires annuel." }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">0{idx + 1}</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{item.title}</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-normal">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-center text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-2xl" />
            <p className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest">Le fardeau financier</p>
            <div className="font-mono text-4xl font-black text-white">45%</div>
            <p className="text-xs text-zinc-300 max-w-xs mx-auto">
              des petits détaillants font faillite en raison d'une mauvaise gestion de leurs ardoises de crédit et d'un manque de trésorerie.
            </p>
            <div className="border-t border-zinc-800 pt-3 flex justify-around text-left">
              <div>
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Pertes moyennes</span>
                <span className="text-sm font-bold text-white">12% / an</span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Temps de recouvrement</span>
                <span className="text-sm font-bold text-white">28 jours</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "La Solution : WakatMarket ERP",
      subtitle: "Un écosystème hybride, connecté et résilient",
      badge: "Notre Solution",
      icon: Sparkles,
      bgColor: "from-emerald-950 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
          {[
            {
              title: "Offline-First & PWA",
              desc: "Parfaitement fonctionnel dans les zones à faible connectivité. Les vendeurs encaissent, scannent et enregistrent les dettes hors-ligne, la synchronisation Supabase se déclenche dès le retour du réseau.",
              icon: Smartphone,
              color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            },
            {
              title: "Gestion du Crédit Connecté",
              desc: "Remplacez le cahier par une ardoise numérique interactive. Définissez des limites de crédit, suivez les cumuls, encaissez des paiements partiels et recevez des alertes visuelles proactives à 80% du seuil.",
              icon: Database,
              color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
            },
            {
              title: "Logistique Intelligente",
              desc: "Un portail de communication direct entre Fabricants, Grossistes et Demi-Grossistes. Flux de commandes instantanés, automatisation des prix de gros et IA de recommandation de restockage intégrée.",
              icon: Zap,
              color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
            }
          ].map((box, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between text-left space-y-3">
              <div className="space-y-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${box.color}`}>
                  <box.icon className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">{box.title}</h4>
                <p className="text-[10px] text-zinc-400 leading-relaxed">{box.desc}</p>
              </div>
              <div className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1 mt-2">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Actif dans la v2
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      title: "L'Opportunité de Marché",
      subtitle: "Une opportunité colossale et sous-équipée",
      badge: "Taille du Marché",
      icon: Globe,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="space-y-6 py-2 text-left">
          <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
            L'Afrique subsaharienne compte plus de 10 millions de petits commerces et des milliers d'usines locales. Notre stratégie se focalise sur l'UEMOA, une zone à monnaie unique facilitant l'échelle régionale.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-center space-y-2">
              <span className="text-[10px] text-zinc-500 uppercase font-black">Marché Total (TAM)</span>
              <div className="text-2xl font-black text-white">$420 Milliards</div>
              <p className="text-[9.5px] text-zinc-400">Valeur totale de la distribution informelle de produits de grande consommation en Afrique.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-center space-y-2">
              <span className="text-[10px] text-emerald-500 uppercase font-black">Marché Accessible (SAM)</span>
              <div className="text-2xl font-black text-emerald-400">$35 Milliards</div>
              <p className="text-[9.5px] text-zinc-400">Volume de transactions géré par les grossistes et demi-grossistes structurés en Afrique de l'Ouest.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-center space-y-2">
              <span className="text-[10px] text-amber-500 uppercase font-black">Part de Marché (SOM - 5 ans)</span>
              <div className="text-2xl font-black text-amber-400">$2.4 Milliards</div>
              <p className="text-[9.5px] text-zinc-400">Objectif de flux annuel de transactions transitant par l'infrastructure WakatMarket.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Notre Technologie",
      subtitle: "Innovation et robustesse architecturale",
      badge: "L'avantage produit",
      icon: LineChart,
      bgColor: "from-indigo-950 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">
              Une architecture pensée pour le terrain africain
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Nous ne faisons pas un ERP de bureau traditionnel. Nous avons bâti un système ultra-performant, réactif et connecté :
            </p>
            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 mt-1">✓</span>
                <p><strong>B2B Marketplace & ERP Unifiés</strong> : Permet aux grossistes de passer des commandes directement aux usines, tout en vendant instantanément à leurs détaillants locaux.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 mt-1">✓</span>
                <p><strong>Dette client sous contrôle</strong> : Suivi rigoureux avec graphiques d'évolution Dette vs Chiffre d'Affaires pour éviter le surendettement.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 mt-1">✓</span>
                <p><strong>PWA Multi-Plateforme</strong> : Installable sur n'importe quel smartphone Android basique de vendeur, léger et économe en data internet.</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl space-y-3 font-semibold">
            <p className="text-[10px] text-zinc-500 font-extrabold uppercase">DÉMO DU CREDIT SCORE / JAUGE DE CRÉDIT</p>
            <div className="p-4 bg-zinc-950 rounded-xl border border-rose-500/20 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-bold">Acheteur : Diallo Alimentation</span>
                <span className="text-rose-400 font-bold">82% Utilisé</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div className="bg-rose-500 h-full w-[82%] rounded-full animate-pulse" />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>Dette: {formatCFA(246000)}</span>
                <span>Limite: {formatCFA(300000)}</span>
              </div>
              <div className="p-2 bg-rose-500/10 text-rose-400 text-[9px] rounded-lg font-bold border border-rose-500/10 text-center uppercase">
                ⚠️ ALERTE CRÉDIT : Ventes bloquées ou nécessitant validation
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 italic text-center">
              L'algorithme de WakatMarket sécurise la solvabilité des acheteurs locaux en temps réel.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Business Model & Monétisation",
      subtitle: "Un alignement parfait avec la réussite de nos clients",
      badge: "Revenus",
      icon: DollarSign,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2 text-left">
          {[
            {
              title: "SaaS Premium ERP",
              price: "15 000 CFA / mois",
              desc: "Abonnement mensuel pour les grossistes et demi-grossistes. Inclus : fonctionnalités d'ardoise illimitées, gestion d'inventaire poussée, et scans de codes-barres illimités.",
              benefit: "Revenu Récurrent Prévisible"
            },
            {
              title: "Commissions B2B",
              price: "0.5% - 1.2% / transaction",
              desc: "Prélèvement d'une commission sur les commandes passées directement via l'application entre les grossistes affiliés et les usines agro-alimentaires.",
              benefit: "Scale direct avec le volume"
            },
            {
              title: "Score de Crédit & Microfinance",
              price: "Partage de revenus",
              desc: "Nous mettons en relation nos clients solvables (grâce à leur score historique d'ardoise propre sur l'ERP) avec des institutions de microfinance partenaires.",
              benefit: "Fintech à haute valeur"
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">{item.title}</h4>
                <div className="text-lg font-black text-emerald-400 font-mono">{item.price}</div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
              <div className="p-2 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl text-[9.5px] font-bold text-center uppercase">
                {item.benefit}
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      title: "Traction & Plan de Déploiement",
      subtitle: "Notre feuille de route vers le leadership régional",
      badge: "Traction",
      icon: TrendingUp,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">
              Une exécution rythmée par étapes structurées
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              WakatMarket déploie sa plateforme de manière stratégique pour acquérir des nœuds de réseau à forte valeur (les grossistes) qui amènent naturellement leurs détaillants :
            </p>
            <div className="space-y-3 text-xs text-zinc-300">
              {[
                { label: "Phase 1 : Consolidation (Burkina Faso)", desc: "Acquisition de 150 grossistes clés à Ouagadougou et Bobo-Dioulasso. Validation du modèle de credit-scoring." },
                { label: "Phase 2 : Expansion (Côte d'Ivoire & Mali)", desc: "Déploiement à Abidjan et Bamako. Partenariats avec des banques locales pour la microfinance." },
                { label: "Phase 3 : Fintech & Paiements intégrés", desc: "Intégration native des APIs Mobile Money (Wave, Orange Money) pour simplifier les règlements d'ardoises." }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-2.5">
                  <span className="text-amber-500 font-bold shrink-0">●</span>
                  <div>
                    <strong className="text-white block font-bold">{step.label}</strong>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">{step.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest mb-1">Nos Chiffres Clés Cléments (Projection 18m)</p>
              <div className="space-y-2.5 mt-3 text-xs">
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Grossistes actifs</span>
                  <span className="text-white font-bold">500+</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Détaillants connectés</span>
                  <span className="text-white font-bold">4,500+</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Volume de Transactions (GMV)</span>
                  <span className="text-white font-bold">$12M / an</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Taux de rétention (SaaS)</span>
                  <span className="text-emerald-400 font-bold">94.2%</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 italic text-center">
              Le modèle d'acquisition en étoile (Hub-and-Spoke) garantit un coût d'acquisition client (CAC) extrêmement faible.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "L'Équipe Fondatrice",
      subtitle: "La passion de l'innovation et l'expérience du terrain",
      badge: "L'Équipe",
      icon: Users,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="space-y-6 py-2 text-left">
          <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
            Notre force réside dans notre parfaite connaissance de l'Afrique de l'Ouest et notre capacité à concevoir et livrer du logiciel résilient de classe mondiale.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg mx-auto">UT</div>
              <h4 className="font-bold text-xs text-white">Urbain Traoré</h4>
              <p className="text-[10px] text-zinc-400">Co-fondateur & CEO</p>
              <p className="text-[9px] text-zinc-500 leading-normal">Expert en gestion commerciale et fin connaisseur des circuits de distribution en Afrique de l'Ouest.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mx-auto">AD</div>
              <h4 className="font-bold text-xs text-white">Alassane Diallo</h4>
              <p className="text-[10px] text-zinc-400">CTO & Lead Architect</p>
              <p className="text-[9px] text-zinc-500 leading-normal">Précédemment ingénieur principal chez une licorne fintech panafricaine. Spécialiste Offline-First et base de données synchronisées.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-lg mx-auto">KM</div>
              <h4 className="font-bold text-xs text-white">Kadidia Maïga</h4>
              <p className="text-[10px] text-zinc-400">Directrice des Opérations</p>
              <p className="text-[9px] text-zinc-500 leading-normal">7 ans de gestion de la chaîne d'approvisionnement dans le secteur des boissons. Anciennement Heineken West Africa.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "L'Offre Investisseur",
      subtitle: "Rejoignez l'aventure WakatMarket",
      badge: "Le Deal",
      icon: Award,
      bgColor: "from-emerald-900 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white">
              Une levée de fonds de 500 000 $ en Pre-Seed
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Nous levons des fonds pour accélérer notre vitesse d'acquisition commerciale et asseoir notre position de leader incontournable dans l'UEMOA :
            </p>
            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex gap-2.5 items-start">
                <span className="w-4.5 h-4.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">50%</span>
                <p><strong>Acquisition de Grossistes & Marketing</strong> : Déploiement d'une force commerciale sur le terrain pour onboarder et former les grossistes d'Afrique de l'Ouest.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-4.5 h-4.5 rounded bg-blue-500/10 text-blue-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">30%</span>
                <p><strong>Développement Produit & IA</strong> : Amélioration de notre moteur d'IA Forecasting et consolidation des APIs financières de recouvrement.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="w-4.5 h-4.5 rounded bg-amber-500/10 text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">20%</span>
                <p><strong>Conformité, Juridique et Opérations locales</strong> : Ouverture des filiales et conformité avec les réglementations de monnaie de l'UEMOA.</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-800/40 to-zinc-900 border border-emerald-500/20 p-6 rounded-2xl flex flex-col justify-center text-center space-y-4 relative">
            <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">Le Partenaire Idéal</p>
            <h4 className="text-lg font-black text-white leading-snug">Révolutionnons ensemble la distribution informelle africaine</h4>
            <p className="text-xs text-zinc-300">
              Urbain Traoré • Président Directeur Général
            </p>
            <div className="font-mono text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 py-2.5 rounded-xl font-bold">
              urbain.traoreurb@gmail.com • Ouagadougou
            </div>
          </div>
        </div>
      )
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        nextSlide();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const SlideIcon = slides[currentSlide].icon;

  return (
    <div className="bg-zinc-950 text-white rounded-3xl border border-zinc-800 shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden transition-all" id="investor-pitch-deck-container">
      {/* Absolute Background Accent Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
            <SlideIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-emerald-500/10">
              {slides[currentSlide].badge}
            </span>
            <h3 className="font-extrabold text-base text-white tracking-tight mt-1">{slides[currentSlide].title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Autoplay toggle */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition border cursor-pointer ${
              isPlaying 
                ? "bg-amber-600 border-amber-500 text-white" 
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Lecture Auto
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Défiler Auto
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition text-xs font-bold shrink-0 cursor-pointer"
            title="Fermer le Pitch Deck"
          >
            Fermer ✕
          </button>
        </div>
      </div>

      {/* Main Slide Content Area */}
      <div className="min-h-[300px] flex items-center justify-center py-6 px-2 z-10 relative transition-all duration-300">
        <div className="w-full animate-fade-in">
          {slides[currentSlide].content}
        </div>
      </div>

      {/* Bottom Navigation and Progress Dots */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-zinc-800/80 pt-4 z-10 relative">
        <div className="flex items-center gap-1.5 order-2 sm:order-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentSlide(idx);
                setIsPlaying(false);
              }}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                currentSlide === idx 
                  ? "bg-emerald-500 w-6" 
                  : "bg-zinc-800 w-2 hover:bg-zinc-700"
              }`}
              title={`Diapositive ${idx + 1}`}
            />
          ))}
        </div>
        
        <div className="flex items-center gap-3 order-1 sm:order-2">
          <button
            onClick={() => {
              prevSlide();
              setIsPlaying(false);
            }}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
            title="Précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-mono text-xs text-zinc-500 font-bold uppercase tracking-wider">
            Slide {currentSlide + 1} / {slides.length}
          </span>
          
          <button
            onClick={() => {
              nextSlide();
              setIsPlaying(false);
            }}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
            title="Suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
