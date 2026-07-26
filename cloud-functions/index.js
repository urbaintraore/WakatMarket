const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const { envoyerDemandeConnexion, repondreDemandeConnexion } = require('./partenaires');
const { enregistrerVente } = require('./enregistrerVente');

exports.envoyerDemandeConnexion = envoyerDemandeConnexion;
exports.repondreDemandeConnexion = repondreDemandeConnexion;
exports.enregistrerVente = enregistrerVente;
