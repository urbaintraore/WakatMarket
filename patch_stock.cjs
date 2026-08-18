const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `      if (changedItem) {
        try {
          await inventoryService.updateInventoryItem(changedItem);
          setInventory(updated);
          addNotification("Stock mis à jour et synchronisé sur le Cloud.");
        } catch (err) {
          console.error("Erreur Supabase lors de la mise à jour du stock:", err);
          addNotification("Erreur : Impossible de mettre à jour le stock sur Supabase.");
        }
      }`;

const replacement1 = `      if (changedItem) {
        setInventory(updated);
        try {
          await inventoryService.updateInventoryItem(changedItem);
          addNotification("Stock mis à jour et synchronisé sur le Cloud.");
        } catch (err) {
          console.error("Erreur Supabase lors de la mise à jour du stock:", err);
          addNotification("Stock mis à jour localement (Échec sync. cloud).");
        }
      }`;

if (code.includes(target1)) {
    code = code.replace(target1, replacement1);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Replaced target1!");
}

