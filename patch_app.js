const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const newFunc = `
  const handleUpdateUserProfileAdmin = async (userId: string, fields: Partial<UserProfile>) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        return { ...u, ...fields };
      }
      return u;
    });
    syncUsers(updated);
    addNotification("Profil utilisateur mis à jour avec succès (Admin).");

    try {
      const fbUpdate: any = {};
      if (fields.role !== undefined) fbUpdate.rôle = fields.role;
      if (fields.country !== undefined) fbUpdate.pays = fields.country;
      if (fields.region !== undefined) fbUpdate.ville = fields.region;
      if (fields.sector !== undefined) fbUpdate.quartier = fields.sector;
      if (fields.phone !== undefined) fbUpdate.téléphone = fields.phone;
      if (fields.latitude !== undefined) fbUpdate.latitude = fields.latitude;
      if (fields.longitude !== undefined) fbUpdate.longitude = fields.longitude;
      
      if (fields.name) {
        fbUpdate.nom = fields.name.split(" ").slice(1).join(" ") || fields.name;
        fbUpdate.prénom = fields.name.split(" ")[0];
      }
      
      await userService.updateUser(userId, fbUpdate);
    } catch (err) {
      console.error("Erreur mise à jour Firestore par admin:", err);
    }
  };
`;

content = content.replace(
  "const handleChangeUserRole =",
  newFunc + "\n  const handleChangeUserRole ="
);

content = content.replace(
  "onChangeUserRole={handleChangeUserRole}",
  "onChangeUserRole={handleChangeUserRole}\n                  onUpdateUser={handleUpdateUserProfileAdmin}"
);

fs.writeFileSync('src/App.tsx', content);
