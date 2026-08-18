#!/bin/bash

# Fix productService.ts upsert
sed -i 's/prix_gros: product.prixGros || null,/\/\/ prix_gros: product.prixGros || null,/' src/services/productService.ts
sed -i 's/prix_detail: product.prixDetail || null,/\/\/ prix_detail: product.prixDetail || null,/' src/services/productService.ts
sed -i 's/quantite_minimum: product.quantiteMinimum || 1,/\/\/ quantite_minimum: product.quantiteMinimum || 1,/' src/services/productService.ts
sed -i 's/barcode: product.barcode || null,/\/\/ barcode: product.barcode || null,/' src/services/productService.ts
sed -i 's/qr_code: product.qrCode || null,/\/\/ qr_code: product.qrCode || null,/' src/services/productService.ts
sed -i 's/expiration_date: product.expirationDate || null,/\/\/ expiration_date: product.expirationDate || null,/' src/services/productService.ts

# Fix productService.ts update
sed -i 's/if (updates.prixGros !== undefined) dbUpdates.prix_gros = updates.prixGros;/\/\/ if (updates.prixGros !== undefined) dbUpdates.prix_gros = updates.prixGros;/' src/services/productService.ts
sed -i 's/if (updates.prixDetail !== undefined) dbUpdates.prix_detail = updates.prixDetail;/\/\/ if (updates.prixDetail !== undefined) dbUpdates.prix_detail = updates.prixDetail;/' src/services/productService.ts
sed -i 's/if (updates.quantiteMinimum !== undefined) dbUpdates.quantite_minimum = updates.quantiteMinimum;/\/\/ if (updates.quantiteMinimum !== undefined) dbUpdates.quantite_minimum = updates.quantiteMinimum;/' src/services/productService.ts

# Fix inventoryService.ts upsert
sed -i 's/prix_gros: item.prixGros ? Number(item.prixGros) : null,/\/\/ prix_gros: item.prixGros ? Number(item.prixGros) : null,/' src/services/inventoryService.ts
sed -i 's/prix_detail: item.prixDetail ? Number(item.prixDetail) : null,/\/\/ prix_detail: item.prixDetail ? Number(item.prixDetail) : null,/' src/services/inventoryService.ts
sed -i 's/quantite_minimum: item.quantiteMinimum ? Number(item.quantiteMinimum) : 1,/\/\/ quantite_minimum: item.quantiteMinimum ? Number(item.quantiteMinimum) : 1,/' src/services/inventoryService.ts
sed -i 's/expiration_date: item.expirationDate || null,/\/\/ expiration_date: item.expirationDate || null,/' src/services/inventoryService.ts

