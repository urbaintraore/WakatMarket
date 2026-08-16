const fs = require('fs');
let code = fs.readFileSync('src/components/EditProductStockModal.tsx', 'utf8');

const oldButton = `                {(inventoryItem || product) && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce produit du stock ?")) {
                        onDelete(inventoryItem?.id || "", product?.id || "");
                        onClose();
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer du stock
                  </button>
                )}`;

const newButton = `                {(inventoryItem || product) && onDelete && (
                  <div className="relative">
                    {showConfirmDelete ? (
                      <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900 p-3 rounded-xl shadow-xl w-64 z-50 animate-fade-in">
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">Confirmer la suppression définitive ?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowConfirmDelete(false)}
                            className="flex-1 px-2 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(inventoryItem?.id || "", product?.id || "");
                              setShowConfirmDelete(false);
                              onClose();
                            }}
                            className="flex-1 px-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Oui, Supprimer
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(true)}
                      className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> Supprimer du stock
                    </button>
                  </div>
                )}`;

if(code.includes(oldButton)) {
  code = code.replace(oldButton, newButton);
  fs.writeFileSync('src/components/EditProductStockModal.tsx', code);
  console.log('EditProductStockModal button replaced');
} else {
  console.log('Could not find oldButton');
}
