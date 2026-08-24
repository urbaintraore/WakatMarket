import React, { useState, useEffect } from "react";
import { 
  Compass, ChevronLeft, ChevronRight, Play, Pause, TrendingUp, 
  Target, Users, ShieldCheck, DollarSign, Globe, Sparkles, 
  Briefcase, LineChart, Award, Smartphone, Database, CheckCircle, Zap,
  Download, Printer, FileText, Cpu, MessageSquare, ShoppingBag, BarChart3,
  Check, X, AlertTriangle, Layers, Radio
} from "lucide-react";
import { formatCFA } from "../data";
import { generatePitchDeckPDF } from "../utils/pitchDeckPdf";

interface PitchDeckProps {
  onClose: () => void;
}

export default function PitchDeck({ onClose }: PitchDeckProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPDF = () => {
    setIsExporting(true);
    try {
      generatePitchDeckPDF();
    } catch (err) {
      console.error("[PitchDeck] Erreur lors de l'exportation du PDF:", err);
    } finally {
      setTimeout(() => setIsExporting(false), 800);
    }
  };

  const handlePrintDeck = () => {
    window.print();
  };

  const slides = [
    // SLIDE 1: VISION GLOBALE
    {
      title: "WakatMarket d'Afrique de l'Ouest",
      subtitle: "Pitch Deck Investisseur • Série Seed",
      badge: "Vision Globale",
      icon: Compass,
      bgColor: "from-emerald-950 to-zinc-950",
      content: (
        <div className="space-y-6 text-center py-4">
          <p className="text-xs md:text-sm text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
            La Révolution B2B Distribution & FinTech Ouest-Africaine
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight max-w-3xl mx-auto">
            La première plateforme hybride d'approvisionnement, caisse POS et crédit B2B pour l'Afrique de l'Ouest
          </h2>
          <p className="text-zinc-300 text-xs md:text-sm max-w-2xl mx-auto leading-relaxed">
            WakatMarket digitalise la chaîne logistique traditionnelle et sécurise l'encours de crédit client (l'ardoise) entre Fabricants, Grossistes, Demi-Grossistes et Détaillants avec une architecture Offline-First résiliente.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <div className="bg-white/5 border border-white/10 px-5 py-3.5 rounded-2xl text-left min-w-[140px]">
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Marché Cible (TAM)</p>
              <p className="text-xl font-black text-white mt-0.5">$420B+</p>
              <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">Commerce informel régional</p>
            </div>
            <div className="bg-white/5 border border-white/10 px-5 py-3.5 rounded-2xl text-left min-w-[140px]">
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Technologie Cœur</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">Offline-First PWA</p>
              <p className="text-[9px] text-emerald-500/80 font-bold mt-0.5">SyncQueue Supabase</p>
            </div>
            <div className="bg-white/5 border border-white/10 px-5 py-3.5 rounded-2xl text-left min-w-[140px]">
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Innovation FinTech</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">Credit Scoring</p>
              <p className="text-[9px] text-amber-500/80 font-bold mt-0.5">Ardoise & Risque contrôlé</p>
            </div>
            <div className="bg-white/5 border border-white/10 px-5 py-3.5 rounded-2xl text-left min-w-[140px]">
              <p className="text-[10px] text-zinc-400 font-bold uppercase">Moteur IA</p>
              <p className="text-xl font-black text-blue-400 mt-0.5">WakatAI Engine</p>
              <p className="text-[9px] text-blue-500/80 font-bold mt-0.5">Prédiction & Restockage</p>
            </div>
          </div>
        </div>
      )
    },

    // SLIDE 2: LE PROBLÈME
    {
      title: "Le Problème du Commerce Informel",
      subtitle: "L'ardoise manuelle, les coupures réseau et l'opacité logistique",
      badge: "Points de friction",
      icon: Target,
      bgColor: "from-rose-950 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-4 text-left">
            <h3 className="text-lg font-black text-white leading-snug">
              Pourquoi le commerce traditionnel d'Afrique de l'Ouest est bloqué
            </h3>
            <p className="text-zinc-300 text-xs leading-relaxed">
              En Afrique de l'Ouest, plus de 90% du commerce de détail passe par des réseaux informels. Les acteurs souffrent de verrous structurels majeurs :
            </p>
            <div className="space-y-2.5">
              {[
                { title: "Opacité de l'Ardoise Manuelle (Crédit Client)", desc: "Les crédits sont notés sur de simples cahiers volants, entraînant pertes d'écritures, litiges constants et impayés irrécouvrables." },
                { title: "Fracture Réseau & Électrique Répétée", desc: "Les pannes Internet et de courant rendent les ERP cloud standards totalement inutilisables au comptoir lors des heures de pointe." },
                { title: "Ruptures de Stock & Surstockage Aveugle", desc: "Absence d'outils analytiques proactifs. Les usines et grossistes n'ont aucun suivi réel de l'inventaire de leurs revendeurs." }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">0{idx + 1}</span>
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
            <p className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest">Impact sur l'économie locale</p>
            <div className="font-mono text-4xl font-black text-white">45%</div>
            <p className="text-xs text-zinc-300 max-w-xs mx-auto">
              des petits commerçants détaillants font faillite en raison d'une mauvaise gestion de leurs crédits clients et du manque de trésorerie.
            </p>
            <div className="border-t border-zinc-800 pt-3 flex justify-around text-left">
              <div>
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Pertes moyennes d'ardoise</span>
                <span className="text-sm font-bold text-rose-400">12% du CA / an</span>
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

    // SLIDE 3: ENSEMBLE DES FONCTIONNALITÉS
    {
      title: "L'Éventail Complet des Fonctionnalités",
      subtitle: "La suite logicielle 360° conçue pour le terrain",
      badge: "Fonctionnalités Clés",
      icon: Layers,
      bgColor: "from-emerald-950 to-zinc-950",
      content: (
        <div className="space-y-4 py-1 text-left">
          <p className="text-xs text-zinc-300">
            WakatMarket rassemble dans une seule interface PWA réactive l'ensemble des modules indispensables aux commerçants et industriels :
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              {
                title: "1. Caisse POS & Offline-First",
                desc: "Enregistrement ultra-rapide des ventes, impression thermique bluetooth, scanner code-barres et file de synchronisation en arrière-plan.",
                icon: Smartphone,
                color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
              },
              {
                title: "2. L'Ardoise Numérique B2B",
                desc: "Suivi rigoureux des dettes clients, plafonds de crédit, remboursements partiels, téléversement de reçus et justificatifs.",
                icon: Database,
                color: "text-blue-400 border-blue-500/20 bg-blue-500/10"
              },
              {
                title: "3. Credit-Scoring & Risque",
                desc: "Algorithme de calcul de la solvabilité acheteur avec jauge visuelle d'alerte à 80% du plafond et blocage d'impayés.",
                icon: ShieldCheck,
                color: "text-rose-400 border-rose-500/20 bg-rose-500/10"
              },
              {
                title: "4. Hub d'Approvisionnement",
                desc: "Réseau direct Fabricants ➔ Grossistes ➔ Détaillants avec demandes de partenariat, catalogue partagé et commandes directes.",
                icon: ShoppingBag,
                color: "text-amber-400 border-amber-500/20 bg-amber-500/10"
              },
              {
                title: "5. Messagerie B2B Vocale/Texte",
                desc: "Tchat sécurisé en temps réel avec enregistrement de notes vocales, envoi de devis et pièces jointes réservé aux partenaires actifs.",
                icon: MessageSquare,
                color: "text-purple-400 border-purple-500/20 bg-purple-500/10"
              },
              {
                title: "6. Moteur IA WakatAI",
                desc: "Prévisions de ventes, recommandation intelligente de réapprovisionnement, gestion des péremptions et démarques.",
                icon: Cpu,
                color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10"
              },
              {
                title: "7. Gestion Clients Légers",
                desc: "Carnet de clients informels de passage sans compte, avec export rapide du bilan de dette par WhatsApp, SMS et PDF.",
                icon: Users,
                color: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10"
              },
              {
                title: "8. Multi-Devises & Mobile Money",
                desc: "Prise en charge du FCFA (XOF/XAF), USD, et intégrations Wave, Orange Money, Moov Money, Telecel Cash.",
                icon: DollarSign,
                color: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10"
              }
            ].map((mod, idx) => (
              <div key={idx} className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`p-1.5 rounded-lg border ${mod.color}`}>
                      <mod.icon className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-[11px] font-black text-white">{mod.title}</h4>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal">{mod.desc}</p>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
                  <Check className="w-3 h-3" /> Opérationnel
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    },

    // SLIDE 4: ORIGINALITÉ ET DIFFÉRENCIATION
    {
      title: "Originalité & Différenciation Unique",
      subtitle: "Pourquoi WakatMarket surpasse les plateformes existantes",
      badge: "Avantage Concurrentiel",
      icon: Sparkles,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="space-y-4 py-1 text-left">
          <p className="text-xs text-zinc-300">
            Comparatif direct entre WakatMarket, les ERP traditionnels de bureau, les caisses POS simples et les plateformes e-commerce classiques :
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase text-[9px] font-black">
                  <th className="p-2.5">Fonctionnalité / Critère</th>
                  <th className="p-2.5">ERP Traditionnel (SAP, Odoo)</th>
                  <th className="p-2.5">Caisse POS (Loyverse, Kyte)</th>
                  <th className="p-2.5">E-Commerce Classique</th>
                  <th className="p-2.5 text-emerald-400 bg-emerald-500/10 border-l border-r border-emerald-500/20">WakatMarket ERP B2B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                <tr className="hover:bg-zinc-900/40">
                  <td className="p-2.5 font-bold text-white">Fonctionnement 100% Offline PWA</td>
                  <td className="p-2.5 text-rose-400">❌ Nécessite connexion 24/7</td>
                  <td className="p-2.5 text-amber-400">⚠️ Partiel (Stock local)</td>
                  <td className="p-2.5 text-rose-400">❌ Web uniquement</td>
                  <td className="p-2.5 text-emerald-400 font-bold bg-emerald-500/5 border-l border-r border-emerald-500/20">✅ Total (Caisse + SyncQueue)</td>
                </tr>
                <tr className="hover:bg-zinc-900/40">
                  <td className="p-2.5 font-bold text-white">Ardoise & Credit-Scoring B2B</td>
                  <td className="p-2.5 text-amber-400">⚠️ Module comptable lourd</td>
                  <td className="p-2.5 text-rose-400">❌ Absence de crédit B2B</td>
                  <td className="p-2.5 text-rose-400">❌ Paiement comptant direct</td>
                  <td className="p-2.5 text-emerald-400 font-bold bg-emerald-500/5 border-l border-r border-emerald-500/20">✅ Seuil, Rapprochement & Jauge</td>
                </tr>
                <tr className="hover:bg-zinc-900/40">
                  <td className="p-2.5 font-bold text-white">Chaîne Usine ➔ Grossiste ➔ Détaillant</td>
                  <td className="p-2.5 text-amber-400">⚠️ Intégration sur-mesure très chère</td>
                  <td className="p-2.5 text-rose-400">❌ Mono-boutique isolée</td>
                  <td className="p-2.5 text-amber-400">⚠️ B2C / B2B basique</td>
                  <td className="p-2.5 text-emerald-400 font-bold bg-emerald-500/5 border-l border-r border-emerald-500/20">✅ Hub B2B unifié & Prix de gros</td>
                </tr>
                <tr className="hover:bg-zinc-900/40">
                  <td className="p-2.5 font-bold text-white">Messagerie B2B & Notes Vocales</td>
                  <td className="p-2.5 text-rose-400">❌ Inexistant</td>
                  <td className="p-2.5 text-rose-400">❌ Inexistant</td>
                  <td className="p-2.5 text-rose-400">❌ Chatbot B2C basique</td>
                  <td className="p-2.5 text-emerald-400 font-bold bg-emerald-500/5 border-l border-r border-emerald-500/20">✅ Tchat vocal/doc partenaire actif</td>
                </tr>
                <tr className="hover:bg-zinc-900/40">
                  <td className="p-2.5 font-bold text-white">Moteur IA Restockage & Péremption</td>
                  <td className="p-2.5 text-amber-400">⚠️ Option payante haut de gamme</td>
                  <td className="p-2.5 text-rose-400">❌ Statistiques de base</td>
                  <td className="p-2.5 text-amber-400">⚠️ Recommandation d'achat B2C</td>
                  <td className="p-2.5 text-emerald-400 font-bold bg-emerald-500/5 border-l border-r border-emerald-500/20">✅ WakatAI prédictif FMCG</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-3">
            <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-[10.5px] text-zinc-200">
              <strong>Ce qui nous rend imbattables :</strong> L'effet de réseau Hub-and-Spoke. Lorsqu'un grand grossiste adopte WakatMarket, il impose l'application à ses 20 à 50 demi-grossistes et détaillants affiliés pour sécuriser leurs ardoises partagées.
            </p>
          </div>
        </div>
      )
    },

    // SLIDE 5: TECHNOLOGIE OFFLINE & IA
    {
      title: "PWA Offline-First & Moteur IA",
      subtitle: "Conçu pour résister aux contraintes d'infrastructure locales",
      badge: "L'avantage Produit",
      icon: LineChart,
      bgColor: "from-indigo-950 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Une architecture logicielle conçue pour le terrain
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              En Afrique de l'Ouest, l'application ne doit jamais bloquer une vente à cause du réseau. C'est pourquoi nous avons développé :
            </p>
            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-emerald-400 font-bold text-sm">✓</span>
                <div>
                  <strong className="text-white block">File de Synchronisation `syncQueue`</strong>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Toutes les opérations (ventes, crédits, commandes) sont enregistrées localement et poussées automatiquement vers Supabase dès la reconnexion.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-emerald-400 font-bold text-sm">✓</span>
                <div>
                  <strong className="text-white block">Moteur IA WakatAI (Gemini)</strong>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Analyse la vélocité des stocks, suggère la quantité exacte de commande de réapprovisionnement et propose des ventes flash sur produits à péremption proche.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3 font-semibold flex flex-col justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider mb-2">SCHÉMA DE SYNCHRONISATION BIDIRECTIONNELLE</p>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center space-y-2 text-xs">
                <div className="flex justify-between items-center text-[10px] text-emerald-400 font-bold px-2">
                  <span>📱 App Mobile PWA Local Storage</span>
                  <span>⚡ SyncQueue Engine</span>
                  <span>☁️ Supabase Cloud DB</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full animate-pulse" />
                </div>
                <p className="text-[9.5px] text-zinc-400 italic">
                  Opérations garanties 0% de perte de données même en cas de coupure de réseau de 72 heures.
                </p>
              </div>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-left space-y-1">
              <p className="text-[10px] text-indigo-400 font-bold uppercase">Scanner & Impression</p>
              <p className="text-[9.5px] text-zinc-300">
                Support universel des imprimantes thermiques de reçu 58mm/80mm Bluetooth & USB + scan caméra instantané.
              </p>
            </div>
          </div>
        </div>
      )
    },

    // SLIDE 6: ARDOISE NUMÉRIQUE ET CREDIT SCORING
    {
      title: "L'Ardoise Numérique & Credit Scoring",
      subtitle: "Securiser le crédit informel et automatiser la solvabilité",
      badge: "Inclusion FinTech",
      icon: ShieldCheck,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Du cahier de dette manuscrit au scoring financier automatisé
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              L'ardoise est le moteur de vente du commerce ouest-africain. WakatMarket la sécurise sans dénaturer la relation de confiance :
            </p>
            <div className="space-y-2 text-xs text-zinc-300">
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-emerald-400">1. Plafonnement de Crédit</strong> : Chaque grossiste attribue une limite maximale à son acheteur (ex: 500 000 FCFA).
              </div>
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-amber-400">2. Alerte Visuelle à 80%</strong> : Jauge dynamique qui avertit le vendeur avant le dépassement du seuil critique.
              </div>
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                <strong className="text-blue-400">3. Traçabilité des Règlements</strong> : Enregistrement des acomptes avec génération instantanée de récépissé téléchargeable et preuve de virement.
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3 font-semibold">
            <p className="text-[10px] text-zinc-500 font-extrabold uppercase">DÉMO DU CREDIT SCORE / JAUGE DE CRÉDIT B2B</p>
            <div className="p-4 bg-zinc-950 rounded-xl border border-rose-500/30 space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-bold">Acheteur : Diallo Alimentation</span>
                <span className="text-rose-400 font-black">82% Utilisé</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div className="bg-rose-500 h-full w-[82%] rounded-full animate-pulse" />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Dette actuelle: {formatCFA(246000)}</span>
                <span>Plafond: {formatCFA(300000)}</span>
              </div>
              <div className="p-2 bg-rose-500/10 text-rose-400 text-[9.5px] rounded-lg font-bold border border-rose-500/20 text-center uppercase">
                ⚠️ ALERTE CRÉDIT : Seuil critique atteint • Prochaine commande soumise à validation
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 italic text-center">
              L'historique de paiement propre permet d'attribuer un Score de Solvabilité certifié réutilisable auprès des banques partenaires.
            </p>
          </div>
        </div>
      )
    },

    // SLIDE 7: MODÈLE ÉCONOMIQUE ET MARCHE
    {
      title: "Modèle Économique & Opportunité",
      subtitle: "Un alignement parfait avec la croissance du commerce informel",
      badge: "Monétisation",
      icon: DollarSign,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2 text-left">
          {[
            {
              title: "SaaS Premium ERP",
              price: "15 000 FCFA / mois",
              desc: "Abonnement mensuel récurrent des grossistes et demi-grossistes. Inclus : caisse POS illimitée, gestion d'ardoise, scans codes-barres et synthèses IA.",
              benefit: "Revenu Récurrent Prévisible (ARR)"
            },
            {
              title: "Commissions B2B",
              price: "0.5% - 1.2% / transaction",
              desc: "Frais prélevés sur le volume de commandes de réapprovisionnement passées directement via le Hub B2B entre grossistes affiliés et usines agro-alimentaires.",
              benefit: "Scale direct avec le volume GMV"
            },
            {
              title: "Monétisation Score FinTech",
              price: "Partage de revenus",
              desc: "Mise en relation des commerçants solvables (grâce à leur score historique d'ardoise propre sur l'ERP) avec des institutions de microfinance pour du crédit de campagne.",
              benefit: "FinTech à très haute marge"
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">{item.title}</h4>
                <div className="text-xl font-black text-emerald-400 font-mono">{item.price}</div>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[9.5px] font-bold text-center uppercase">
                {item.benefit}
              </div>
            </div>
          ))}
        </div>
      )
    },

    // SLIDE 8: TRACTION ET PROJECTIONS
    {
      title: "Traction & Projections Financières",
      subtitle: "Feuille de route stratégique pour dominer le marché UEMOA",
      badge: "Traction & Plan",
      icon: TrendingUp,
      bgColor: "from-zinc-900 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Une stratégie d'expansion en 3 phases
            </h3>
            <div className="space-y-3 text-xs text-zinc-300">
              {[
                { label: "Phase 1 : Consolidation (Burkina Faso)", desc: "Acquisition de 250 grossistes clés à Ouagadougou et Bobo-Dioulasso. Validation du modèle de credit-scoring et de la caisse POS Offline." },
                { label: "Phase 2 : Expansion UEMOA (Côte d'Ivoire & Mali)", desc: "Déploiement à Abidjan et Bamako. Partenariats stratégiques avec les banques régionales pour la microfinance B2B." },
                { label: "Phase 3 : Intégration FinTech & Mobile Money", desc: "Intégration native des passerelles de paiement Wave, Orange Money et Moov Money pour l'apurement automatique des ardoises." }
              ].map((step, idx) => (
                <div key={idx} className="flex gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-amber-400 font-bold shrink-0">●</span>
                  <div>
                    <strong className="text-white block font-bold">{step.label}</strong>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">{step.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest mb-2">Projections à 3 Ans (Zone UEMOA)</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Grossistes Actifs</span>
                  <span className="text-white font-bold">4,500+</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Détaillants Connectés</span>
                  <span className="text-white font-bold">50,000+</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Volume de Transactions (GMV)</span>
                  <span className="text-emerald-400 font-bold">$220 Millions / an</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 font-semibold">Revenu Annuel Répété (ARR)</span>
                  <span className="text-white font-bold">$5.8 Millions</span>
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

    // SLIDE 9: L'ÉQUIPE ET LE DEAL
    {
      title: "L'Équipe & Offre Investisseurs",
      subtitle: "Une levée Pre-Seed de 500 000 $ pour accélérer",
      badge: "Le Deal",
      icon: Award,
      bgColor: "from-emerald-950 to-zinc-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-left">
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">
              Une levée de 500 000 $ en Pre-Seed
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Nous levons des fonds pour accélérer notre vitesse d'acquisition commerciale et asseoir notre position de leader incontournable dans l'UEMOA :
            </p>
            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex gap-2.5 items-start bg-white/5 p-2 rounded-xl">
                <span className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">50%</span>
                <p><strong>Acquisition de Grossistes & Marketing Terrain</strong> : Force commerciale pour onboarder et former les grossistes de la sous-région.</p>
              </div>
              <div className="flex gap-2.5 items-start bg-white/5 p-2 rounded-xl">
                <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">30%</span>
                <p><strong>Développement R&D & Moteur WakatAI</strong> : Perfectionnement de l'IA prédictive et consolidation des APIs Mobile Money.</p>
              </div>
              <div className="flex gap-2.5 items-start bg-white/5 p-2 rounded-xl">
                <span className="w-6 h-6 rounded bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">20%</span>
                <p><strong>Conformité Juridique & Filiales Réseau</strong> : Conformité réglementaire monétique de la BCEAO/UEMOA.</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/60 to-zinc-900 border border-emerald-500/30 p-6 rounded-2xl flex flex-col justify-center text-center space-y-4 relative">
            <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">Équipe Fondatrice & Contact</p>
            <div className="text-xs text-zinc-300 space-y-1">
              <p className="font-bold text-white text-sm">Urbain Traoré (CEO)</p>
              <p className="text-zinc-400">Alassane Diallo (CTO) • Kadidia Maïga (COO)</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1 text-xs">
              <p className="font-mono text-emerald-300 font-bold">urbain.traoreurb@gmail.com</p>
              <p className="text-[10px] text-zinc-400">Ouagadougou, Burkina Faso • Expansion UEMOA</p>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-900/40"
            >
              <Download className="w-4 h-4" /> Télécharger le Pitch Deck Complet (PDF)
            </button>
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
      }, 6000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const SlideIcon = slides[currentSlide].icon;

  return (
    <div className="bg-zinc-950 text-white rounded-3xl border border-zinc-800 shadow-2xl p-5 md:p-8 space-y-6 relative overflow-hidden transition-all" id="investor-pitch-deck-container">
      {/* Background Accent Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
            <SlideIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/20">
                {slides[currentSlide].badge}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono font-bold">
                Diapositive {currentSlide + 1} / {slides.length}
              </span>
            </div>
            <h3 className="font-extrabold text-base text-white tracking-tight mt-1">{slides[currentSlide].title}</h3>
          </div>
        </div>

        {/* Action Buttons: PDF Download, Print, Autoplay, Close */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950"
            title="Télécharger le Pitch Deck complet au format PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? "Génération..." : "Télécharger PDF"}</span>
          </button>

          <button
            onClick={handlePrintDeck}
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Imprimer / Exporter le Pitch Deck"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Imprimer</span>
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition border cursor-pointer ${
              isPlaying 
                ? "bg-amber-600 border-amber-500 text-white" 
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Auto
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition text-xs font-bold shrink-0 cursor-pointer"
            title="Fermer le Pitch Deck"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Slide Content Area */}
      <div className="min-h-[320px] flex items-center justify-center py-4 px-1 z-10 relative transition-all duration-300">
        <div className="w-full animate-fade-in">
          {slides[currentSlide].content}
        </div>
      </div>

      {/* Bottom Navigation Controls & Slide Selector Dots */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-zinc-800/80 pt-4 z-10 relative">
        <div className="flex items-center gap-1.5 order-2 sm:order-1 flex-wrap justify-center">
          {slides.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentSlide(idx);
                setIsPlaying(false);
              }}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                currentSlide === idx 
                  ? "bg-emerald-500 w-7" 
                  : "bg-zinc-800 w-2.5 hover:bg-zinc-700"
              }`}
              title={`Diapositive ${idx + 1}: ${s.title}`}
            />
          ))}
        </div>
        
        <div className="flex items-center gap-3 order-1 sm:order-2">
          <button
            onClick={() => {
              prevSlide();
              setIsPlaying(false);
            }}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer hover:bg-zinc-800"
            title="Diapositive précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-mono text-xs text-zinc-400 font-bold uppercase tracking-wider">
            {currentSlide + 1} / {slides.length}
          </span>
          
          <button
            onClick={() => {
              nextSlide();
              setIsPlaying(false);
            }}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer hover:bg-zinc-800"
            title="Diapositive suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
