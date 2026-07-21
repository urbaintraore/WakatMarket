const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const newFunc = `
  const isRoleAllowed = (creatorRole: UserRole, targetRole: UserRole): boolean => {
    if (creatorRole === UserRole.ADMIN || targetRole === UserRole.ADMIN) return true;
    
    if (creatorRole === UserRole.MANUFACTURER) {
      return targetRole === UserRole.WHOLESALER || targetRole === UserRole.SEMI_WHOLESALER; // allow semi-wholesaler too just in case
    }
    if (creatorRole === UserRole.WHOLESALER) {
      return targetRole === UserRole.MANUFACTURER || targetRole === UserRole.SEMI_WHOLESALER || targetRole === UserRole.RETAILER;
    }
    if (creatorRole === UserRole.SEMI_WHOLESALER) {
      return targetRole === UserRole.WHOLESALER || targetRole === UserRole.RETAILER || targetRole === UserRole.CLIENT;
    }
    if (creatorRole === UserRole.RETAILER) {
      return targetRole === UserRole.SEMI_WHOLESALER || targetRole === UserRole.CLIENT;
    }
    if (creatorRole === UserRole.CLIENT) {
      return targetRole === UserRole.RETAILER || targetRole === UserRole.SEMI_WHOLESALER;
    }
    return true;
  };
`;

content = content.replace(
  /const isRoleAllowed = \(creatorRole: UserRole, targetRole: UserRole\): boolean => \{[\s\S]*?return true;\s*\};/,
  newFunc.trim()
);

fs.writeFileSync('src/App.tsx', content);
