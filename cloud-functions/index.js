/**
 * WakatMarket — Cloud Functions (SDK v2).
 *
 * Point d'entrée agrégé des fonctions :
 *   - partenaires : demandes de connexion B2B
 *   - enregistrerVente : vente serveur + détection de conflit de stock
 *   - comptabilite : résumés mensuels CA / dépenses
 *   - admin : rôles & suppression de comptes
 *   - paiements : validation / rejet de preuves
 *   - reapprovisionnement : alertes de stock planifiées
 */
exports.envoyerDemandeConnexion = require('./partenaires').envoyerDemandeConnexion;
exports.repondreDemandeConnexion = require('./partenaires').repondreDemandeConnexion;

exports.enregistrerVente = require('./enregistrerVente').enregistrerVente;
exports.onOrderCreated = require('./enregistrerVente').onOrderCreated;

exports.onVenteWritten = require('./comptabilite').onVenteWritten;
exports.onDepenseCreated = require('./comptabilite').onDepenseCreated;

exports.supprimerCompteAdmin = require('./admin').supprimerCompteAdmin;
exports.modifierRoleUtilisateur = require('./admin').modifierRoleUtilisateur;
exports.onProfileWritten = require('./admin').onProfileWritten;
exports.onUserCreated = require('./admin').onUserCreated;

exports.validerPaiementVente = require('./paiements').validerPaiementVente;
exports.rejeterPaiementVente = require('./paiements').rejeterPaiementVente;
exports.onPreuvePaiementSoumise = require('./paiements').onPreuvePaiementSoumise;

exports.verifierAlertesReapprovisionnementPlanifie = require('./reapprovisionnement').verifierAlertesReapprovisionnementPlanifie;
exports.recalculerAlertesReapprovisionnement = require('./reapprovisionnement').recalculerAlertesReapprovisionnement;