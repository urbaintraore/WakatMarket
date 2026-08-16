const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldDelete = `  const handleDeleteInventoryItem = async (itemId: string, productId?: string, skipConfirm: boolean = false) => {
    const shouldDelete = skipConfirm || window.confirm("Voulez-vous vraiment retirer ce produit de votre stock ?");
    if (!shouldDelete) return;

    const itemToDelete = inventory.find(i => i.id === itemId || i.productId === itemId || (productId && i.productId === productId));
    const targetItemId = itemToDelete ? itemToDelete.id : itemId;
    const targetProdId = productId || itemToDelete?.productId || itemId;

    // Call service to delete from backend database
    try {
      if (targetItemId) {
        await inventoryService.deleteInventoryItem(targetItemId);
      }
      if (targetProdId) {
        await productService.deleteProduct(targetProdId);
      }
    } catch (err) {
      console.warn("Error deleting inventory item via service:", err);
    }

    // Filter out from local state after deletion
    const updatedInventory = inventory.filter((item) => item.id !== targetItemId && item.productId !== targetProdId);
    syncInventory(updatedInventory);

    const updatedProducts = products.filter((p) => p.id !== targetProdId);
    syncProducts(updatedProducts);

    addNotification("Produit retiré de votre stock avec succès.");
  };`;

const newDelete = `  const handleDeleteInventoryItem = async (itemId: string, productId?: string, skipConfirm: boolean = false) => {
    const doDelete = async () => {
      const itemToDelete = inventory.find(i => i.id === itemId || i.productId === itemId || (productId && i.productId === productId));
      const targetItemId = itemToDelete ? itemToDelete.id : itemId;
      const targetProdId = productId || itemToDelete?.productId || itemId;

      try {
        if (targetItemId) await inventoryService.deleteInventoryItem(targetItemId);
        if (targetProdId) await productService.deleteProduct(targetProdId);
      } catch (err) {
        console.warn("Error deleting inventory item via service:", err);
      }

      const updatedInventory = inventory.filter((item) => item.id !== targetItemId && item.productId !== targetProdId);
      syncInventory(updatedInventory);

      const updatedProducts = products.filter((p) => p.id !== targetProdId);
      syncProducts(updatedProducts);

      addNotification("Produit retiré de votre stock avec succès.");
    };

    if (skipConfirm) {
      doDelete();
    } else {
      setConfirmDeleteAction({
        isOpen: true,
        title: "Retirer du stock",
        message: "Voulez-vous vraiment retirer ce produit de votre stock ?",
        onConfirm: doDelete
      });
    }
  };`;

const oldClear = `  const handleClearMyCatalog = async () => {
    if (!currentUser) return;
    const shouldClear = window.confirm("Voulez-vous vraiment effacer tous les articles fictifs et réels de votre catalogue stock pour recommencer manuellement ? Cette action est irréversible.");
    if (!shouldClear) return;

    // Filter items owned by user or having mock prefixes
    const itemsToDelete = inventory.filter(i => 
      i.ownerId === currentUser.id || 
      i.ownerId === currentUser.email || 
      i.id.includes("bonk") || 
      i.id.includes("sayouba")
    );

    if (itemsToDelete.length === 0) {
      addNotification("Votre catalogue de stock est déjà vide.");
      return;
    }

    // Local state filter
    const remainingInventory = inventory.filter(i => 
      !(i.ownerId === currentUser.id || 
        i.ownerId === currentUser.email || 
        i.id.includes("bonk") || 
        i.id.includes("sayouba"))
    );
    syncInventory(remainingInventory);

    {
      addNotification("Suppression en cours du catalogue en ligne...");
      await Promise.allSettled(
        itemsToDelete.map(item => inventoryService.deleteInventoryItem(item.id))
      );
    }

    addNotification("Votre catalogue a été entièrement vidé. Vous pouvez maintenant le renseigner manuellement.");
  };`;

const newClear = `  const handleClearMyCatalog = async () => {
    if (!currentUser) return;
    
    const doClear = async () => {
      const itemsToDelete = inventory.filter(i => 
        i.ownerId === currentUser.id || 
        i.ownerId === currentUser.email || 
        i.id.includes("bonk") || 
        i.id.includes("sayouba")
      );

      if (itemsToDelete.length === 0) {
        addNotification("Votre catalogue de stock est déjà vide.");
        return;
      }

      const remainingInventory = inventory.filter(i => 
        !(i.ownerId === currentUser.id || 
          i.ownerId === currentUser.email || 
          i.id.includes("bonk") || 
          i.id.includes("sayouba"))
      );
      syncInventory(remainingInventory);

      {
        addNotification("Suppression en cours du catalogue en ligne...");
        await Promise.allSettled(
          itemsToDelete.map(item => inventoryService.deleteInventoryItem(item.id))
        );
      }

      addNotification("Votre catalogue a été entièrement vidé. Vous pouvez maintenant le renseigner manuellement.");
    };

    setConfirmDeleteAction({
      isOpen: true,
      title: "Vider mon stock",
      message: "Voulez-vous vraiment effacer tous les articles fictifs et réels de votre catalogue stock pour recommencer manuellement ? Cette action est irréversible.",
      onConfirm: doClear
    });
  };`;

if(code.includes(oldDelete)) {
  code = code.replace(oldDelete, newDelete);
  console.log('Replaced delete');
} else {
  console.log('Could not find old delete block');
}

if(code.includes(oldClear)) {
  code = code.replace(oldClear, newClear);
  console.log('Replaced clear');
} else {
  console.log('Could not find old clear block');
}

fs.writeFileSync('src/App.tsx', code);
