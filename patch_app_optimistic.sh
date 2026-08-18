#!/bin/bash

# Fix handleAddProduct
sed -i 's/await productService.createProduct(newProd);/setProducts(prev => [...prev.filter(x => x.id !== newProd.id), newProd]);\n      setInventory(prev => [...prev.filter(x => x.id !== newInvItem.id), newInvItem]);\n      await productService.createProduct(newProd);/' src/App.tsx
sed -i 's/await inventoryService.updateInventoryItem(newInvItem);/await inventoryService.updateInventoryItem(newInvItem);/' src/App.tsx
sed -i 's/setProducts(prev => \[\.\.\.prev\.filter(x => x\.id !== newProd\.id), newProd\]);//' src/App.tsx
sed -i 's/setInventory(prev => \[\.\.\.prev\.filter(x => x\.id !== newInvItem\.id), newInvItem\]);//' src/App.tsx
sed -i 's/addNotification("Erreur : Impossible d'\''enregistrer le produit sur le Cloud Supabase.");/addNotification("Produit créé localement (Non synchronisé : Erreur Cloud).");/' src/App.tsx

