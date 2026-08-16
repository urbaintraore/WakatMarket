const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `        <ResetPasswordModal`;

const modalCode = `        {/* Custom Confirm Modal for Iframe compatibility */}
        <AnimatePresence>
          {confirmDeleteAction && confirmDeleteAction.isOpen && (
            <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
                  <Trash2 className="w-6 h-6" />
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{confirmDeleteAction.title}</h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                  {confirmDeleteAction.message}
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setConfirmDeleteAction(null)} 
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={() => { 
                      confirmDeleteAction.onConfirm(); 
                      setConfirmDeleteAction(null); 
                    }} 
                    className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-500 transition shadow-sm shadow-rose-600/20"
                  >
                    Confirmer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <ResetPasswordModal`;

if(code.includes(target)) {
  code = code.replace(target, modalCode);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Modal added');
} else {
  console.log('Could not find target');
}
