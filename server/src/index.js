/**
 * WakatMarket API — entrypoint Express (Render).
 *
 * Port des Cloud Functions vers une API REST :
 *   POST /api/ventes                    → enregistrerVente
 *   POST /api/orders/:id/process        → onOrderCreated (conflits de stock)
 *   POST /api/paiements/:id/valider     → validerPaiementVente
 *   POST /api/paiements/:id/rejeter     → rejeterPaiementVente
 *   POST /api/paiements/:id/preuve      → onPreuvePaiementSoumise
 *   POST /api/relations                 → envoyerDemandeConnexion
 *   POST /api/relations/:id/repondre    → repondreDemandeConnexion
 *   POST /api/relations/:id/process     → notifications relations offline
 *   POST/PATCH/DELETE /api/admin/...    → admin (rôles, suppression, claims)
 *   POST /api/comptabilite/...          → onVenteWritten / onDepenseCreated
 *   GET|POST /api/cron/stock-alerts     → verifierAlertesReapprovisionnement
 */
import express from 'express';
import cors from 'cors';

import ventesRouter from './routes/ventes.js';
import ordersRouter from './routes/orders.js';
import paiementsRouter from './routes/paiements.js';
import relationsRouter from './routes/relations.js';
import adminRouter from './routes/admin.js';
import comptabiliteRouter from './routes/comptabilite.js';
import cronRouter, { executerCalculVitesseEtAlertes } from './routes/cron.js';
import { requireAuth, requireCronSecret } from './auth.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'wakatmarket-api', time: new Date().toISOString() });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ uid: req.uid, time: new Date().toISOString() });
});

app.use('/api/ventes', requireAuth, ventesRouter);
app.use('/api/orders', requireAuth, ordersRouter);
app.use('/api/paiements', requireAuth, paiementsRouter);
app.use('/api/relations', requireAuth, relationsRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.use('/api/comptabilite', requireAuth, comptabiliteRouter);
app.use('/api/cron', requireCronSecret, cronRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Ressource introuvable.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[api] Erreur non gérée:', err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

export { app, executerCalculVitesseEtAlertes };

const port = Number(process.env.PORT || 4000);
app.listen(port, '0.0.0.0', () => {
  console.log(`[wakatmarket-api] Écoute sur le port ${port}`);
});