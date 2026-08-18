const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target3 = `    try {
      if (productData && Object.keys(productData).length > 0) {
        await productService.createOrUpdateProduct({ id: productId, ...productData } as any);
        const updatedProducts = products.map((p) => {
          if (p.id === productId) {
            return { ...p, ...productData };
          }
          return p;
        });
        setProducts(updatedProducts);
      }`;

const replacement3 = `      if (productData && Object.keys(productData).length > 0) {
        const updatedProducts = products.map((p) => {
          if (p.id === productId) {
            return { ...p, ...productData };
          }
          return p;
        });
        setProducts(updatedProducts);
      }
      
    try {
      if (productData && Object.keys(productData).length > 0) {
        await productService.createOrUpdateProduct({ id: productId, ...productData } as any);
      }`;

const target4 = `          await inventoryService.updateInventoryItem({ ...targetItem, ...inventoryData });
          const updatedInventory = inventory.map((i) => {
            if (i.id === inventoryItemId) {
              return { ...i, ...inventoryData };
            }
            return i;
          });
          setInventory(updatedInventory);
        }
      }

      addNotification("Produit et stock mis à jour et synchronisés sur le Cloud !");
    } catch (err) {
      console.error("Erreur Supabase lors de la mise à jour produit/stock:", err);
      addNotification("Erreur : Échec de la mise à jour sur Supabase.");
    }`;

const replacement4 = `          const updatedInventory = inventory.map((i) => {
            if (i.id === inventoryItemId) {
              return { ...i, ...inventoryData };
            }
            return i;
          });
          setInventory(updatedInventory);
          await inventoryService.updateInventoryItem({ ...targetItem, ...inventoryData });
        }
      }

      addNotification("Produit et stock mis à jour et synchronisés sur le Cloud !");
    } catch (err) {
      console.error("Erreur Supabase lors de la mise à jour produit/stock:", err);
      addNotification("Produit et stock mis à jour localement (Échec sync. cloud).");
    }`;

if (code.includes(target3)) {
    code = code.replace(target3, replacement3);
    console.log("Replaced target3!");
}
if (code.includes(target4)) {
    code = code.replace(target4, replacement4);
    console.log("Replaced target4!");
}
fs.writeFileSync('src/App.tsx', code);

