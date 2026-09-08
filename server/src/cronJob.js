/**
 * Cron helper — node src/cronJob.js
 * Utilisé par le service cron Render (ou un scheduler externe) : déclenche
 * le calcul des alertes de réapprovisionnement sur l'API.
 *
 * Env attendues :
 *   CRON_JOB_URL  : URL de l'API (ex. https://wakatmarket-api.onrender.com)
 *   CRON_SECRET   : partagé avec le serveur (header x-cron-secret)
 */
const url = (process.env.CRON_JOB_URL || '').replace(/\/$/, '') + '/api/cron/stock-alerts';
const secret = process.env.CRON_SECRET || '';

async function run() {
  if (!secret) {
    console.error('CRON_SECRET manquant — abandon.');
    process.exit(1);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret }
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Échec cron (${res.status}) :`, body);
    process.exit(1);
  }
  console.log('Cron exécuté :', body);
}

run().catch((e) => {
  console.error('Erreur cron :', e);
  process.exit(1);
});