/**
 * Cloudflare Worker — r2-uploads
 *
 * Contrat avec le client (src/cloudflare.ts) :
 *   POST /sign   { path, contentType, size? }  → { uploadUrl, publicUrl }
 *                 (URL PUT présignée vers R2 ; le client fait un PUT direct)
 *   GET  /file/<path...>  → sert l'objet R2 (fallback public si pas de bucket public)
 *   OPTIONS               → CORS
 *
 * Secrets (wrangler secret put) : R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * Vars (wrangler.toml [vars]) : ACCOUNT_ID, BUCKET_NAME, R2_PUBLIC_BASE (optionnel)
 * Binding R2 : bucket "R2"
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Access-Control-Max-Age': '86400'
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...headers }
  });
}

/** Valide un chemin d'upload : pas de '..', caractères sûrs uniquement. */
function isValidPath(path) {
  if (!path || path.length === 0 || path.length > 1024) return false;
  if (path.includes('..') || path.includes('//')) return false;
  return /^[A-Za-z0-9][A-Za-z0-9_\-/.]*$/.test(path);
}

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function hexDigest(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(digest);
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signature AWS SigV4 pour un PUT présigné vers R2. */
async function presignPut(path, contentType, env, url) {
  const accountId = env.ACCOUNT_ID;
  const bucket = env.BUCKET_NAME;
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKey || !secretKey) {
    throw new Error('Config Worker manquante (ACCOUNT_ID, BUCKET_NAME, clés R2).');
  }

  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';
  const expires = 3600;

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${path}`;

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host;content-type'
  };

  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    'host;content-type',
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await hexDigest(canonicalRequest)
  ].join('\n');

  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));

  return `https://${host}/${canonicalUri.replace(/^\//, '')}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

export default {
  async fetch(request, envWorker) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // =========================================================================
    // GET /file/<path...> : sert un objet R2
    // =========================================================================
    if (request.method === 'GET' && pathname.startsWith('/file/')) {
      const key = decodeURIComponent(pathname.slice('/file/'.length));
      if (!isValidPath(key)) return json({ error: 'Chemin invalide.' }, 400);

      const bucket = envWorker.R2;
      const obj = await bucket.get(key);
      if (!obj) return json({ error: 'Fichier introuvable.' }, 404);

      return new Response(obj.body, {
        headers: {
          'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
          'ETag': obj.httpEtag,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Accept-Ranges': 'bytes',
          'X-Served-By': 'wakat-r2-uploads',
          ...CORS_HEADERS
        }
      });
    }

    // =========================================================================
    // POST /sign : génère une URL PUT présignée
    // =========================================================================
    if (request.method === 'POST' && pathname === '/sign') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: 'JSON invalide.' }, 400);
      }

      const { path, contentType, size } = body || {};
      if (!isValidPath(path)) return json({ error: 'Path invalide.' }, 400);
      if (!contentType || typeof contentType !== 'string') return json({ error: 'contentType requis.' }, 400);

      if (size != null && Number(size) > 100 * 1024 * 1024) {
        return json({ error: 'Fichier trop volumineux (max 100 Mo).' }, 413);
      }

      try {
        const uploadUrl = await presignPut(path, contentType, envWorker, url);
        const publicUrl = (envWorker.R2_PUBLIC_BASE ? `${envWorker.R2_PUBLIC_BASE.replace(/\/$/, '')}/` : `${url.origin}/file/`) + path;
        return json({ uploadUrl, publicUrl });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // =========================================================================
    // GET / : health
    // =========================================================================
    if (request.method === 'GET') {
      return json({
        ok: true,
        service: 'wakat-r2-uploads',
        provider: 'Cloudflare Workers + R2'
      });
    }

    return json({ error: 'Route inconnue.' }, 404);
  }
};