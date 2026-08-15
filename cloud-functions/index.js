const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const { envoyerDemandeConnexion, repondreDemandeConnexion } = require('./partenaires');
const { enregistrerVente, onVenteCreated } = require('./enregistrerVente');
const { onVenteWritten, onDepenseCreated } = require('./comptabilite');
const { supprimerCompteAdmin, modifierRoleUtilisateur, onUserCreated, onUserDocWritten } = require('./admin');
const { validerPaiementVente, rejeterPaiementVente, onPreuvePaiementSoumise } = require('./paiements');
const { verifierAlertesReapprovisionnementPlanifie, recalculerAlertesReapprovisionnement } = require('./reapprovisionnement');

exports.envoyerDemandeConnexion = envoyerDemandeConnexion;
exports.repondreDemandeConnexion = repondreDemandeConnexion;
exports.enregistrerVente = enregistrerVente;
exports.onVenteCreated = onVenteCreated;
exports.onVenteWritten = onVenteWritten;
exports.onDepenseCreated = onDepenseCreated;
exports.supprimerCompteAdmin = supprimerCompteAdmin;
exports.modifierRoleUtilisateur = modifierRoleUtilisateur;
exports.onUserCreated = onUserCreated;
exports.onUserDocWritten = onUserDocWritten;
exports.validerPaiementVente = validerPaiementVente;
exports.rejeterPaiementVente = rejeterPaiementVente;
exports.onPreuvePaiementSoumise = onPreuvePaiementSoumise;
exports.verifierAlertesReapprovisionnementPlanifie = verifierAlertesReapprovisionnementPlanifie;
exports.recalculerAlertesReapprovisionnement = recalculerAlertesReapprovisionnement;

