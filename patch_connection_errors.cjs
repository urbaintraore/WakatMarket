const fs = require('fs');
let code = fs.readFileSync('src/services/connectionService.ts', 'utf8');

code = code.replace(/console\.error\("Erreur fetch connections Supabase:", error\);/g, `if (error.code === 'PGRST205') { return; }\n        console.error("Erreur fetch connections Supabase:", error);`);
code = code.replace(/console\.error\("Erreur fetch notifications Supabase:", error\);/g, `if (error.code === 'PGRST205') { return; }\n        console.error("Erreur fetch notifications Supabase:", error);`);

fs.writeFileSync('src/services/connectionService.ts', code);
