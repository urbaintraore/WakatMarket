const fs = require('fs');

let content = fs.readFileSync('src/components/RoleDashboards.tsx', 'utf8');

// Replace handleCheckoutPOS implementations to accept saleData
content = content.replace(/const handleCheckoutPOS = \(\) => \{[\s\S]*?alert\("Vente comptoir enregistrée !"\);\s*\};/g, `const handleCheckoutPOS = async (saleData: any) => {
    // 1. Appel de la Cloud Function 'enregistrerVente' (simulé ou réel)
    try {
      /* 
      // VRAI APPEL CLOUD FUNCTION (Décommenter si Firebase configuré)
      import { getFunctions, httpsCallable } from "firebase/functions";
      const functions = getFunctions();
      const enregistrerVente = httpsCallable(functions, 'enregistrerVente');
      await enregistrerVente(saleData);
      */
      
      // Simulation pour l'UI React locale :
      const items = saleData.lignes.map((l: any) => ({ productId: l.produitId, quantity: l.quantite }));
      onPlaceSale(saleData.acheteurId || "CASH_CLIENT", items, posAmountPaid, "CASH");
      
      setPosCart({});
      setPosAmountPaid(0);
      setPosSelectedLightClientId("");
    } catch (e: any) {
      throw new Error("Erreur de transaction : " + e.message);
    }
  };`);

// Add currentUser prop to POSComponent
content = content.replace(/<POSComponent\s+inventory=\{myInventory\}/g, '<POSComponent\n            currentUser={currentUser}\n            inventory={myInventory}');

// Also replace handlePOSCheckout which might be in RetailerDashboard
content = content.replace(/const handlePOSCheckout = \(\) => \{[\s\S]*?alert\("Vente enregistrée avec succès !"\);\s*\};/g, `const handlePOSCheckout = async (saleData: any) => {
    try {
      // Simulation
      const items = saleData.lignes.map((l: any) => ({ productId: l.produitId, quantity: l.quantite }));
      onPlaceSale(saleData.acheteurId || "CASH_CLIENT", items, posAmountPaid, "CASH");
      
      setPosCart({});
      setPosAmountPaid(0);
      setPosSelectedLightClientId("");
    } catch (e: any) {
      throw new Error("Erreur : " + e.message);
    }
  };`);

// Rename any remaining handlePOSCheckout inside POSComponent props just in case
content = content.replace(/onCheckout=\{handlePOSCheckout\}/g, 'onCheckout={handleCheckoutPOS}');

fs.writeFileSync('src/components/RoleDashboards.tsx', content, 'utf8');
