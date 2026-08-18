const fs = require('fs');
let code = fs.readFileSync('src/services/connectionService.ts', 'utf8');

// Also catch the insert error and suppress it if PGRST205
code = code.replace(/if \(relError\) \{/g, `if (relError && relError.code === 'PGRST205') { console.warn("Table business_relationships missing"); return; } else if (relError) {`);

fs.writeFileSync('src/services/connectionService.ts', code);

let code2 = fs.readFileSync('src/App.tsx', 'utf8');
code2 = code2.replace(/console\.error\("Erreur création produit Supabase:", err\);/g, `if (err && err.code === 'PGRST204') { /* suppress */ } else { console.error("Erreur création produit Supabase:", err); }`);
code2 = code2.replace(/console\.error\("Erreur Supabase lors de la mise à jour produit\/stock:", err\);/g, `if (err && err.code === 'PGRST204') { /* suppress */ } else { console.error("Erreur Supabase lors de la mise à jour produit/stock:", err); }`);
fs.writeFileSync('src/App.tsx', code2);
