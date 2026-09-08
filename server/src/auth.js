/**
 * Authentification — middleware Express (remplace request.auth des callables).
 *
 *   requireAuth        : vérifie le JWT Firebase (Bearer) et pose req.uid.
 *   requireAdminAuth   : ajoute la vérification du rôle admin côté serveur.
 *   requireCronSecret  : protection des endpoints planifiés (header x-cron-secret).
 */
import { admin, isAdminUid } from './common.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Vous devez être connecté pour effectuer cette action.' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (e) {
    console.warn('[auth] Token invalide :', e.message);
    return res.status(401).json({ error: 'Session invalide ou expirée. Reconnectez-vous.' });
  }
}

export async function requireAdminAuth(req, res, next) {
  try {
    await requireAuth(req, res, async () => {
      const ok = await isAdminUid(req.uid);
      if (!ok) {
        return res.status(403).json({ error: 'Accès refusé. Vous devez être administrateur pour effectuer cette opération.' });
      }
      next();
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne lors du contrôle des droits.' });
  }
}

export function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET || '';
  if (!expected) {
    return res.status(503).json({ error: 'CRON_SECRET non configuré sur le serveur.' });
  }
  const provided = req.headers['x-cron-secret'] || req.headers['x-cron-secret'];
  if (provided !== expected) {
    return res.status(403).json({ error: 'Secret invalide.' });
  }
  next();
}