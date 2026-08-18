#!/bin/bash
cat << 'INNER' > patch.js
const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    };

    try {
      
      
      await productService.createProduct(newProd);
      await inventoryService.updateInventoryItem(newInvItem);
      
      
      addNotification(\`Nouveau produit créé et synchronisé sur le Cloud : \${p.name}\`);
    } catch (err) {
      console.error("Erreur création produit Supabase:", err);
      addNotification("Produit créé localement (Non synchronisé : Erreur Cloud).");
    }`;

const replacement = `    };

    setProducts(prev => [...prev.filter(x => x.id !== newProd.id), newProd]);
    setInventory(prev => [...prev.filter(x => x.id !== newInvItem.id), newInvItem]);

    try {
      await productService.createProduct(newProd);
      await inventoryService.updateInventoryItem(newInvItem);
      addNotification(\`Nouveau produit créé et synchronisé sur le Cloud : \${p.name}\`);
    } catch (err) {
      console.error("Erreur création produit Supabase:", err);
      addNotification("Produit créé localement (Échec sync. cloud, réessayez plus tard).");
    }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Successfully replaced block!");
} else {
    console.log("Block not found. Looking for similarities...");
    console.log(code.substring(code.indexOf("await productService.createProduct(newProd);") - 100, code.indexOf("await productService.createProduct(newProd);") + 300));
}
INNER
node patch.js
