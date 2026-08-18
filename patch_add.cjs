const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target2 = `      try {
        await inventoryService.updateInventoryItem(newItem);
        setInventory([...inventory, newItem]);
        addNotification(\`Nouveau produit ajouté et synchronisé sur le Cloud.\`);
      } catch (err) {
        console.error("Erreur Supabase lors de l'ajout du stock:", err);
        addNotification("Erreur : Impossible d'ajouter le stock sur Supabase.");
      }`;

const replacement2 = `      setInventory([...inventory, newItem]);
      try {
        await inventoryService.updateInventoryItem(newItem);
        addNotification(\`Nouveau produit ajouté et synchronisé sur le Cloud.\`);
      } catch (err) {
        console.error("Erreur Supabase lors de l'ajout du stock:", err);
        addNotification("Produit ajouté localement (Échec sync. cloud).");
      }`;

if (code.includes(target2)) {
    code = code.replace(target2, replacement2);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Replaced target2!");
}
