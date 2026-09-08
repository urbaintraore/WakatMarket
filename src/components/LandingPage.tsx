import { useRef } from "react";
import { motion, useInView } from "motion/react";
import {
  Factory, Warehouse, Store, ShoppingBasket, ShoppingCart, Truck,
  ArrowRight, LockKeyhole, CloudOff, RefreshCw, ScanBarcode, Users, LineChart,
  Globe2, MessageSquare, Bell, PackageCheck, ChevronDown, BadgeCheck, Boxes
} from "lucide-react";
import { UserRole } from "../types";

export interface LandingPageProps {
  onSelectRole: (role: UserRole) => void;
  onOpenAuth?: () => void;
}

interface RoleAccess {
  role: UserRole;
  label: string;
  tagline: string;
  description: string;
  color: string;        // accent classes for active states
  icon: LucideIconType;
  features: string[];
}

type LucideIconType = typeof Factory;

const ROLE_ACCESS: RoleAccess[] = [
  {
    role: UserRole.MANUFACTURER,
    label: "Fabricant",
    tagline: "Produire & approvisionner",
    description: "Publiez votre catalogue, suivez vos ventes et développez votre réseau de grossistes sur toute la sous-région.",
    color: "indigo",
    icon: Factory,
    features: ["Catalogue produits & stocks", "Ventes B2B en gros", "Réseau de distributeurs"],
  },
  {
    role: UserRole.WHOLESALER,
    label: "Grossiste",
    tagline: "Stocker & distribuer",
    description: "Achetez aux meilleures conditions, gérez vos stocks en temps réel et fournissez les détaillants.",
    color: "emerald",
    icon: Warehouse,
    features: ["Approvisionnement B2B", "Stock & alertes de rupture", "Vente aux détaillants"],
  },
  {
    role: UserRole.SEMI_WHOLESALER,
    label: "Demi-Grossiste",
    tagline: "Relais de distribution",
    description: "Un pont entre les grands grossistes et les boutiques de quartier, avec des prix de gros avantageux.",
    color: "teal",
    icon: Store,
    features: ["Achats groupés", "Prix de gros", "Carnet de clients détaillants"],
  },
  {
    role: UserRole.RETAILER,
    label: "Détaillant",
    tagline: "Vendre en boutique",
    description: "Approvisionnez votre boutique facilement, suivez vos ventes au quotidien et fidélisez vos clients.",
    color: "amber",
    icon: ShoppingBasket,
    features: ["Commandes rapides fournisseurs", "Caisse & ventes", "Clients fidélisés"],
  },
  {
    role: UserRole.CLIENT,
    label: "Client final",
    tagline: "Acheter malin",
    description: "Commandez vos produits en quantité souhaitée et suivez vos achats, paiements et livraisons.",
    color: "sky",
    icon: ShoppingCart,
    features: ["Catalogue du quartier", "Paiements échelonnés", "Livraison suivie"],
  },
  {
    role: UserRole.DRIVER_R2C,
    label: "Livreur",
    tagline: "Livrer sur le terrain",
    description: "Réceptionnez les missions de livraison, suivez vos tournées et encaissez en toute confiance.",
    color: "orange",
    icon: Truck,
    features: ["Missions de livraison", "Preuves de livraison", "Suivi des tournées"],
  },
  ];

const PLATFORM_FEATURES = [
  { icon: CloudOff, title: "100% hors-ligne", text: "Travaillez sans connexion : vos données restent disponibles et se synchronisent dès que le réseau revient." },
  { icon: RefreshCw, title: "Synchronisation auto", text: "File d'attente intelligente et rattrapage automatique : aucune vente, commande ou mise à jour n'est perdue." },
  { icon: ScanBarcode, title: "Scanner intégré", text: "Code-barres, codes QR et gestion précise des stocks pour une caisse rapide et fiable." },
  { icon: LineChart, title: "Tableaux de bord par rôle", text: "Chaque acteur dispose de son espace dédié : fabricant, grossiste, détaillant, livreur, client…" },
  { icon: Globe2, title: "Réseau B2B régional", text: "Connectez-vous à vos partenaires au Sénégal, en Côte d'Ivoire et au Burkina Faso." },
  { icon: MessageSquare, title: "Messagerie intégrée", text: "Échangez avec vos fournisseurs et clients, avec preuves de paiement et suivi des commandes." },
];

export default function LandingPage({ onSelectRole, onOpenAuth }: LandingPageProps) {
  const rolesRef = useRef<HTMLDivElement>(null);
  const rolesInView = useInView(rolesRef, { once: true, margin: "-80px" });

  const scrollToRoles = () => {
    rolesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-50/80 dark:bg-zinc-950/80 border-b border-zinc-200/70 dark:border-zinc-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 flex items-center justify-center text-white">
              <Store className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold text-lg tracking-tight text-zinc-950 dark:text-white">
                Wakat<span className="text-emerald-600 dark:text-emerald-400">Market</span>
              </p>
              <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                Distribution & Logistique
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="#espaces"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
            >
              Espaces par rôle
            </a>
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shadow-sm cursor-pointer"
            >
              <LockKeyhole className="w-4 h-4" />
              Se connecter
            </button>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.12),transparent_70%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-6"
            >
              <BadgeCheck className="w-4 h-4" />
              B2B + B2C · Afrique de l'Ouest
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.05] text-zinc-950 dark:text-white"
            >
              Le commerce de gros,
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500">
                {" "}sans frontières.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="mt-5 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl"
            >
              WakatMarket connecte fabricants, grossistes, détaillants, livreurs et clients
              sur une même plateforme — même sans connexion internet. Chaque acteur a son
              espace dédié : choisissez le vôtre et lancez-vous.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button
                onClick={scrollToRoles}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:scale-[0.99] transition cursor-pointer"
              >
                Accéder à mon espace
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-bold hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
              >
                Créer mon compte
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-10 grid grid-cols-3 max-w-md gap-6"
            >
              {[
                { value: "7", label: "espaces acteurs" },
                { value: "3", label: "pays couverts" },
                { value: "100%", label: "hors-ligne" },
              ].map((s) => (
                <div key={s.label} className="border-l-2 border-emerald-500/40 pl-3">
                  <p className="text-2xl font-extrabold text-zinc-950 dark:text-white">{s.value}</p>
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero visual: dashboard preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-900/10 overflow-hidden">
              <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Espace Grossiste — Aperçu
                </span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: PackageCheck, label: "Stock actif", value: "128" },
                    { icon: LineChart, label: "Ventes 7j", value: "3,2M" },
                    { icon: Users, label: "Partenaires", value: "24" },
                  ].map((c) => (
                    <div key={c.label} className="rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/70 dark:bg-zinc-950/50">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                        <c.icon className="w-4 h-4" />
                      </div>
                      <p className="text-lg font-extrabold text-zinc-950 dark:text-white">{c.value}</p>
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{c.label}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/50">
                    <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Produits populaires</p>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      <RefreshCw className="w-3 h-3" /> Synchronisé
                    </span>
                  </div>
                  {[
                    { name: "Sac de Riz 50kg", price: "22 500 F", qty: "36" },
                    { name: "Carton Huile Dinor 5L", price: "14 200 F", qty: "12" },
                    { name: "Tonne d'Farine Mil", price: "31 000 F", qty: "8" },
                  ].map((r) => (
                    <div key={r.name} className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                          <Boxes className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{r.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-extrabold text-zinc-950 dark:text-white">{r.price}</p>
                        <p className="text-[10px] text-zinc-400">{r.qty} sacs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-6 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl px-5 py-4 flex items-center gap-3 rotate-[-2deg]">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Truck className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-zinc-950 dark:text-white">Livraison suivie</p>
                <p className="text-[10px] font-semibold text-zinc-500">Dakar → Ouagadougou</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== Espaces par rôle ===== */}
      <section id="espaces" ref={rolesRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
            Un espace pour chaque acteur
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            Choisissez votre rôle,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">ouvrez votre espace.</span>
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-sm sm:text-base leading-relaxed">
            Chaque profil est redirigé vers son tableau de bord dédié avec les outils
            adaptés à son activité.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLE_ACCESS.map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={r.role}
                initial={{ opacity: 0, y: 24 }}
                animate={rolesInView ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group relative flex flex-col rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-xl hover:shadow-zinc-900/5 hover:-translate-y-1 transition-all duration-200"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${GRADIENTS[r.color]} shadow-md flex items-center justify-center text-white mb-5`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-zinc-950 dark:text-white">{r.label}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                    {r.tagline}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">{r.description}</p>
                <ul className="space-y-2 mb-6">
                  {r.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[r.color]} shrink-0`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onSelectRole(r.role)}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-bold hover:bg-zinc-950 hover:text-white dark:hover:bg-white dark:hover:text-zinc-950 transition cursor-pointer group"
                >
                  Ouvrir l'espace {r.label.toLowerCase()}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="bg-white dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
              Pourquoi WakatMarket
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Pensé pour le terrain africain
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PLATFORM_FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-3 p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-zinc-950 dark:text-white">{f.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 px-6 sm:px-12 py-12 text-center shadow-xl shadow-emerald-600/20">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-teal-300/20 blur-3xl" />
          <Bell className="w-10 h-10 mx-auto text-white/90 mb-4" />
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white relative">
            Prêt à rejoindre le réseau ?
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-emerald-50/90 relative">
            Créez votre compte et accédez instantanément à votre espace.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 relative">
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-emerald-700 text-sm font-extrabold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition cursor-pointer"
            >
              Créer mon compte
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToRoles}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-900/30 text-white border border-white/25 text-sm font-bold hover:bg-emerald-900/50 transition cursor-pointer"
            >
              Voir les espaces
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
              <Store className="w-4 h-4" />
            </div>
            <p className="text-sm font-extrabold text-zinc-900 dark:text-white">
              Wakat<span className="text-emerald-600 dark:text-emerald-400">Market</span>
            </p>
          </div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Plateforme B2B & B2C de distribution — Sénégal · Côte d'Ivoire · Burkina Faso
          </p>
        </div>
      </footer>
    </div>
  );
}

const GRADIENTS: Record<string, string> = {
  emerald: "from-emerald-500 to-teal-600",
  teal: "from-teal-500 to-cyan-600",
  indigo: "from-indigo-500 to-violet-600",
  amber: "from-amber-500 to-orange-600",
  sky: "from-sky-500 to-blue-600",
  orange: "from-orange-500 to-red-500",
  rose: "from-rose-500 to-pink-600",
};

const DOT_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
};