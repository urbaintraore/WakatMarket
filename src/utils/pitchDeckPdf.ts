import { jsPDF } from "jspdf";

export interface PitchSlideData {
  title: string;
  subtitle: string;
  badge: string;
  keyPoints: string[];
  metrics?: { label: string; value: string }[];
  detailsText?: string;
}

export function generatePitchDeckPDF(): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4" // 297mm x 210mm
  });

  const pageWidth = 297;
  const pageHeight = 210;

  // Primary colors
  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkBg = [15, 23, 42]; // Slate 900
  const cardBg = [30, 41, 59]; // Slate 800
  const accentGold = [245, 158, 11]; // Amber 500
  const textWhite = [255, 255, 255];
  const textGray = [148, 163, 184];

  // ==========================================
  // PAGE 1: COVER SLIDE
  // ==========================================
  // Background
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Emerald Top Accent Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 8, "F");

  // Header Title
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("WAKATMARKET • PITCH DECK INVESTISSEUR 2026", 20, 25);

  // Big Main Title
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text("L'Écosystème ERP B2B & FinTech", 20, 42);
  doc.text("d'Approvisionnement en Afrique de l'Ouest", 20, 54);

  // Subtitle
  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Digitalisation de la chaîne logistique et de l'ardoise de crédit informel", 20, 68);

  // Description Block
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(
    "WakatMarket unifie les Fabricants, Grossistes, Demi-Grossistes et Détaillants dans une solution PWA Offline-First complète. Elle intègre la caisse enregistreuse POS, le suivi de l'ardoise numérique, un moteur de credit-scoring intelligent, la messagerie B2B vocale/texte et des recommandations d'inventaire par IA (WakatAI).",
    250
  );
  doc.text(descLines, 20, 80);

  // Key Value Metric Cards
  const metrics = [
    { label: "Marché Cible (TAM)", val: "$420 Milliards", desc: "Commerce informel Afrique subsaharienne" },
    { label: "Technologie Cœur", val: "Offline-First PWA", desc: "Fonctionnement 100% sans réseau + Sync" },
    { label: "Innovation FinTech", val: "Ardoise & Credit Score", desc: "Maîtrise du risque & solvabilité B2B" },
    { label: "Levée Pre-Seed", val: "$500 000 USD", desc: "Série Seed • Expansion UEMOA" }
  ];

  let cardX = 20;
  metrics.forEach((m) => {
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.roundedRect(cardX, 120, 60, 45, 3, 3, "F");

    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(m.label.toUpperCase(), cardX + 5, 128);

    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(m.val, cardX + 5, 140);

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const mLines = doc.splitTextToSize(m.desc, 50);
    doc.text(mLines, cardX + 5, 150);

    cardX += 65;
  });

  // Footer cover
  doc.setFillColor(20, 30, 45);
  doc.rect(0, 192, pageWidth, 18, "F");
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  doc.text("Contact : Urbain Traoré (CEO) - urbain.traoreurb@gmail.com | Ouagadougou, Burkina Faso", 20, 202);
  doc.text("WakatMarket © 2026 • Confidentiel", pageWidth - 20, 202, { align: "right" });

  // ==========================================
  // PAGE 2: LE PROBLÈME ET L'OPPORTUNITÉ
  // ==========================================
  doc.addPage("a4", "landscape");
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SECTION 01 • POINTS DE FRICTION STRUCTURELS", 20, 18);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(18);
  doc.text("Le Problème : L'Ardoise Manuelle et le Chaos Logistique", 20, 28);

  // Left Column - Pain points
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.roundedRect(20, 38, 125, 140, 3, 3, "F");

  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("1. L'Opacité de l'Ardoise (Crédit Client Informel)", 28, 48);
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const p1 = doc.splitTextToSize("Plus de 90% des ventes s'effectuent à crédit sur des cahiers physiques. Résultats : litiges fréquents, pertes d'écritures, impayés élevés et faillites à répétition.", 110);
  doc.text(p1, 28, 55);

  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("2. La Fracture Réseau & Électrique", 28, 80);
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const p2 = doc.splitTextToSize("Les pannes de courant et coupures Internet rendent les ERP cloud classiques inutilisables au comptoir. Les commerçants refusent les solutions qui s'arrêtent sans réseau.", 110);
  doc.text(p2, 28, 87);

  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("3. Déconnexion Usines-Grossistes-Détaillants", 28, 112);
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const p3 = doc.splitTextToSize("Aucune visibilité en temps réel sur l'état des stocks chez les distributeurs. Ruptures de stock évitables causant jusqu'à 15% de manque à gagner annuel.", 110);
  doc.text(p3, 28, 119);

  // Right Column - Impact Data
  doc.setFillColor(45, 20, 30);
  doc.roundedRect(152, 38, 125, 140, 3, 3, "F");

  doc.setTextColor(244, 63, 94);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("CONSÉQUENCES SUR LE TERRAIN", 160, 48);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("45%", 160, 68);

  doc.setFontSize(9.5);
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  const imp1 = doc.splitTextToSize("des petits commerces informels déposent le bilan en raison d'un manque de trésorerie lié aux impayés sur ardoise.", 110);
  doc.text(imp1, 160, 76);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(22);
  doc.text("28 Jours", 160, 105);

  doc.setFontSize(9.5);
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  const imp2 = doc.splitTextToSize("Délai moyen de recouvrement des créances entre grossistes et demi-grossistes sans outil de suivi dynamique.", 110);
  doc.text(imp2, 160, 113);

  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.roundedRect(160, 138, 109, 30, 2, 2, "F");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("L'IMPACT WAKATMARKET", 165, 146);
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("✓ Réduction de 85% des impayés grâce aux alertes de crédit", 165, 154);
  doc.text("✓ Zéro interruption de caisse en mode hors-ligne PWA", 165, 160);

  // Footer
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  doc.text("WakatMarket Pitch Deck • Slide 2", 20, 202);

  // ==========================================
  // PAGE 3: ENSEMBLE DES FONCTIONNALITÉS
  // ==========================================
  doc.addPage("a4", "landscape");
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SECTION 02 • ARCHITECTURE ET FONCTIONNALITÉS COMPLÈTES", 20, 18);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(18);
  doc.text("Une Suite Logicielles 360° Dédiée au Commerce Ouest-Africain", 20, 28);

  const modules = [
    { title: "Caisse POS & Offline-First", desc: "Comptoir de vente réactif, scanner code-barres camera/USB, impression thermique bluetooth, queue de sync arrière-plan." },
    { title: "L'Ardoise Numérique B2B", desc: "Suivi des dettes, plafonds d'encours, acomptes partiels, justificatifs de paiement et génération de reçus PDF/WhatsApp." },
    { title: "Credit-Scoring & Risque", desc: "Algorithme d'évaluation de la solvabilité acheteur avec jauges d'alerte à 80% du plafond et blocage automatique préventif." },
    { title: "Hub d'Approvisionnement", desc: "Réseau B2B interactif (Fabricants ➔ Grossistes ➔ Détaillants) avec grilles tarifaires dégressives et commandes en direct." },
    { title: "Messagerie Vocale & Texte", desc: "Tchat B2B en temps réel, notes vocales, partage de devis et pièces jointes conditionné par statut de connexion actif." },
    { title: "Moteur IA WakatAI", desc: "Prévisions de ventes, préconisations de réapprovisionnement, alertes de péremption et propositions de démarques." },
    { title: "Carnet Clients Légers", desc: "Gestion rapide des acheteurs informels de passage sans création de compte complexe avec export de bilans de dette." },
    { title: "Multi-Devises & Mobile Money", desc: "Paiement en FCFA (XOF/XAF), USD, et intégrations Wave, Orange Money, Moov Money, Telecel Cash." }
  ];

  let modX = 20;
  let modY = 38;

  modules.forEach((mod, idx) => {
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.roundedRect(modX, modY, 60, 38, 2, 2, "F");

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(modX, modY, 2, 38, "F");

    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(mod.title, modX + 5, modY + 8);

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.2);
    doc.setFont("helvetica", "normal");
    const mLines = doc.splitTextToSize(mod.desc, 52);
    doc.text(mLines, modX + 5, modY + 15);

    modX += 65;
    if ((idx + 1) % 4 === 0) {
      modX = 20;
      modY += 45;
    }
  });

  // Footer
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  doc.text("WakatMarket Pitch Deck • Slide 3", 20, 202);

  // ==========================================
  // PAGE 4: ORIGINALITÉ & MATRICE CONCURRENTIELLE
  // ==========================================
  doc.addPage("a4", "landscape");
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SECTION 03 • POSITIONNEMENT & ORIGINALITÉ UNIQUE", 20, 18);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(18);
  doc.text("Pourquoi WakatMarket est Unique Face aux Solutions Existantes", 20, 28);

  // Table header
  const startY = 38;
  doc.setFillColor(15, 23, 42);
  doc.rect(20, startY, 257, 10, "F");

  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("CRITÈRES D'ÉVALUATION", 25, startY + 7);
  doc.text("ERP TRADITIONNEL (SAP, Odoo)", 85, startY + 7);
  doc.text("POS CLASSIQUE (Loyverse, Kyte)", 150, startY + 7);
  doc.text("WAKATMARKET ERP B2B", 215, startY + 7);

  const compData = [
    { critere: "Fonctionnement 100% Offline PWA", ERP: "❌ Déconnecté / Inadapté", POS: "⚠️ Partiel (Stock local)", WM: "✅ Total (Caisse + SyncQueue)" },
    { critere: "Gestion de l'Ardoise & Crédit B2B", ERP: "⚠️ Module comptable complexe", POS: "❌ Absence de crédit B2B", WM: "✅ Seuil, Rapprochement, Scoring" },
    { critere: "Chaîne Multi-Niveaux Usine ➔ Détaillant", ERP: "⚠️ Nécessite déploiement lourd", POS: "❌ Mono-boutique uniquement", WM: "✅ Hub B2B unifié nativement" },
    { critere: "Messagerie Vocale & Négociation B2B", ERP: "❌ Inexistant", POS: "❌ Inexistant", WM: "✅ Tchat vocal/doc intégré" },
    { critere: "Moteur IA Restockage & Péremption", ERP: "⚠️ Option payante très chère", POS: "❌ Statistiques simples", WM: "✅ IA WakatAI intégrée" },
    { critere: "Modèle de Coût pour Commerçant", ERP: "❌ Très élevé (> $5 000)", POS: "⚠️ $15 - $30 / mois par caisse", WM: "✅ Accessible (15 000 FCFA/mois)" }
  ];

  let rowY = startY + 10;
  compData.forEach((row, i) => {
    const isEven = i % 2 === 0;
    doc.setFillColor(isEven ? cardBg[0] : 20, isEven ? cardBg[1] : 30, isEven ? cardBg[2] : 45);
    doc.rect(20, rowY, 257, 12, "F");

    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(row.critere, 25, rowY + 8);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(226, 232, 240);
    doc.text(row.ERP, 85, rowY + 8);
    doc.text(row.POS, 150, rowY + 8);

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(row.WM, 215, rowY + 8);

    rowY += 12;
  });

  // Highlight Box at bottom
  doc.setFillColor(16, 185, 129, 0.15);
  doc.roundedRect(20, 130, 257, 45, 3, 3, "F");
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(20, 130, 257, 45, 3, 3, "D");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("L'AVANTAGE CONCURRENTIEL INFRANCHISSABLE DE WAKATMARKET", 28, 140);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const advText = doc.splitTextToSize(
    "1. Effet de Réseau Hub-and-Spoke : Chaque grossiste onboardé amène naturellement 10 à 30 demi-grossistes et détaillants.\n2. Barrière à l'Entrée FinTech : Les données historiques d'ardoise et de scoring de solvabilité créent un verrouillage d'usage (switching cost élevé).\n3. Adaptation Culturelle Totale : Prise en compte du parler vocal, du réseau intermittent et de la relation de confiance informelle.",
    240
  );
  doc.text(advText, 28, 148);

  // Footer
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  doc.text("WakatMarket Pitch Deck • Slide 4", 20, 202);

  // ==========================================
  // PAGE 5: MARCHÉ, MODÈLE ÉCONOMIQUE & FINANCIER
  // ==========================================
  doc.addPage("a4", "landscape");
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SECTION 04 • MODÈLE ÉCONOMIQUE & PROJECTIONS", 20, 18);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(18);
  doc.text("Monétisation Tripartite & Opportunité Financière", 20, 28);

  // Revenue Streams
  const streams = [
    { title: "1. SaaS ERP Premium", price: "15 000 FCFA / mois", desc: "Abonnement récurrent des grossistes & demi-grossistes pour caisse POS, ardoise illimitée et rapports IA." },
    { title: "2. Commissions B2B Directes", price: "0.5% à 1.2% / transac.", desc: "Commissions prélevées sur les commandes de restockage en direct des grossistes vers les usines." },
    { title: "3. FinTech & Microfinance", price: "Partage de revenus", desc: "Monétisation du score de solvabilité auprès d'institutions financières partenaires pour le prêt aux PME." }
  ];

  let stX = 20;
  streams.forEach((st) => {
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.roundedRect(stX, 38, 80, 50, 3, 3, "F");

    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.text(st.title, stX + 6, 48);

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(st.price, stX + 6, 58);

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.8);
    doc.setFont("helvetica", "normal");
    const stL = doc.splitTextToSize(st.desc, 68);
    doc.text(stL, stX + 6, 68);

    stX += 88;
  });

  // Financial Forecast Table
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.roundedRect(20, 98, 257, 80, 3, 3, "F");

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Projections Financières sur 3 Ans (Zone UEMOA)", 28, 108);

  // Forecast Headers
  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(8.5);
  doc.text("METRIQUE CLE", 28, 120);
  doc.text("ANNEE 1 (2026)", 100, 120);
  doc.text("ANNEE 2 (2027)", 165, 120);
  doc.text("ANNEE 3 (2028)", 230, 120);

  const fRows = [
    { label: "Grossistes & Demi-Grossistes Actifs", y1: "250", y2: "1,200", y3: "4,500" },
    { label: "Détaillants Utilisateurs Connectés", y1: "2,000", y2: "12,000", y3: "50,000" },
    { label: "Volume de Transactions (GMV)", y1: "$8.5 Millions", y2: "$45 Millions", y3: "$220 Millions" },
    { label: "Revenu Annuel Répété (ARR)", y1: "$180,000", y2: "$1.2 Million", y3: "$5.8 Millions" },
    { label: "Marge Brute Operationnelle", y1: "68%", y2: "76%", y3: "82%" }
  ];

  let fy = 128;
  fRows.forEach((fr) => {
    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(fr.label, 28, fy);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text(fr.y1, 100, fy);
    doc.text(fr.y2, 165, fy);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(fr.y3, 230, fy);

    fy += 9;
  });

  // Footer
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  doc.text("WakatMarket Pitch Deck • Slide 5", 20, 202);

  // ==========================================
  // PAGE 6: L'ÉQUIPE ET L'OFFRE INVESTISSEUR
  // ==========================================
  doc.addPage("a4", "landscape");
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SECTION 05 • L'ÉQUIPE FONDATEUR & L'OFFRE INVESTISSEUR", 20, 18);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(18);
  doc.text("Levée Pre-Seed $500 000 USD pour Accélérer dans l'UEMOA", 20, 28);

  // Team Profiles
  const team = [
    { name: "Urbain Traoré", role: "Co-Fondateur & CEO", bio: "Expert en gestion commerciale et circuits de distribution FMCG en Afrique de l'Ouest." },
    { name: "Alassane Diallo", role: "CTO & Lead Architect", bio: "Ex-ingénieur principal FinTech panafricaine. Spécialiste PWA Offline-First et bases synchronisées." },
    { name: "Kadidia Maïga", role: "Directrice des Opérations", bio: "7 ans dans la gestion de la chaîne d'approvisionnement (ex-Heineken West Africa)." }
  ];

  let tX = 20;
  team.forEach((m) => {
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.roundedRect(tX, 38, 80, 50, 3, 3, "F");

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(m.name, tX + 6, 48);

    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFontSize(8);
    doc.text(m.role, tX + 6, 55);

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const bL = doc.splitTextToSize(m.bio, 68);
    doc.text(bL, tX + 6, 64);

    tX += 88;
  });

  // Deal allocation box
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.roundedRect(20, 98, 125, 80, 3, 3, "F");

  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("UTILISATION DES FONDS LEVÉS ($500 000)", 28, 108);

  const funds = [
    { pct: "50%", title: "Force Commerciale & Onboarding", desc: "Déploiement terrain à Ouagadougou, Bobo-Dioulasso, Abidjan et Bamako." },
    { pct: "30%", title: "R&D Moteur IA & Mobile Money", desc: "Intégration poussée des APIs Wave, Orange Money et algorithme WakatAI." },
    { pct: "20%", title: "Conformité UEMOA & Opérations", desc: "Licences réglementaires, filiales régionales et juridique." }
  ];

  let fy2 = 120;
  funds.forEach((f) => {
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(f.pct, 28, fy2);

    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFontSize(8.5);
    doc.text(f.title, 42, fy2);

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.2);
    doc.setFont("helvetica", "normal");
    const fL = doc.splitTextToSize(f.desc, 100);
    doc.text(fL, 42, fy2 + 5);

    fy2 += 20;
  });

  // Final Call to Action Box
  doc.setFillColor(16, 185, 129, 0.2);
  doc.roundedRect(152, 98, 125, 80, 3, 3, "F");
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(152, 98, 125, 80, 3, 3, "D");

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Rejoignez l'Aventure WakatMarket", 160, 115);

  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const callText = doc.splitTextToSize(
    "Participez à la transformation digitale de la distribution B2B informelle en Afrique de l'Ouest. Nous sommes prêts à scaler et à construire le leader régional de la FinTech d'approvisionnement.",
    110
  );
  doc.text(callText, 160, 125);

  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.roundedRect(160, 150, 109, 20, 2, 2, "F");

  doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("CONTACT INVESTISSEURS :", 165, 158);
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(8);
  doc.text("Urbain Traoré (CEO) • urbain.traoreurb@gmail.com", 165, 164);

  // Footer
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  doc.text("WakatMarket Pitch Deck • Slide 6 • Document Confidentiel", 20, 202);

  // Save the PDF
  doc.save("WakatMarket_Pitch_Deck_Investisseurs_2026.pdf");
}
