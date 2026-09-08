/**
 * Client de stockage Cloudflare R2.
 *
 * Les uploads sont 100 % côté navigateur : le Worker Cloudflare fournit une URL
 * d'upload présignée (PUT S3) et sert les fichiers via son endpoint public.
 * Aucun secret ne transite par le client.
 */
const cloudflareWorkerUrl = (import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").trim();

export let cloudflareConfigError: string | null = null;

if (!cloudflareWorkerUrl) {
  cloudflareConfigError = "Le stockage Cloudflare R2 n'est pas configuré. Renseignez VITE_CLOUDFLARE_WORKER_URL.";
} else {
  try {
    new URL(cloudflareWorkerUrl);
  } catch {
    cloudflareConfigError = `L'URL du Worker Cloudflare ("${cloudflareWorkerUrl}") n'est pas une URL valide.`;
  }
}

export function isCloudflareConfigured(): boolean {
  return !!cloudflareWorkerUrl && !cloudflareConfigError;
}

/**
 * Récupère une URL d'upload présignée depuis le Worker Cloudflare.
 * @returns { uploadUrl: string; publicUrl: string }
 */
async function signUpload(filePath: string, contentType?: string, size?: number): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!cloudflareWorkerUrl) {
    throw new Error(`Cloudflare R2 n'est pas configuré (VITE_CLOUDFLARE_WORKER_URL). ${cloudflareConfigError || ""}`);
  }

  const res = await fetch(`${cloudflareWorkerUrl}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: filePath,
      contentType: contentType || "application/octet-stream",
      size: size || 0
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`[Cloudflare R2] Échec de la signature de l'upload (${res.status}) : ${errText || res.statusText}`);
  }

  const data = await res.json();
  if (!data?.uploadUrl) {
    throw new Error("[Cloudflare R2] Le Worker n'a pas renvoyé d'URL d'upload présignée.");
  }
  return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl || `${cloudflareWorkerUrl}/file/${encodeURIComponent(filePath)}` };
}

/**
 * Upload d'un fichier vers Cloudflare R2 (via Worker).
 * @param folder dossier de rangement (ex: "MonBucket", "Chat")
 * @param filePath chemin du fichier (ex: "products/abc/xyz.jpg")
 * @param fileOrBlob contenu
 * @param contentType type MIME
 * @returns URL publique du fichier
 */
export async function uploadToCloudflare(
  folder: string,
  filePath: string,
  fileOrBlob: File | Blob,
  contentType?: string
): Promise<string> {
  const mime = contentType || (fileOrBlob instanceof File ? fileOrBlob.type : undefined) || "application/octet-stream";
  const fullPath = (folder ? `${folder}/${filePath}` : filePath).replace(/\/+/g, "/");

  const { uploadUrl } = await signUpload(fullPath, mime, fileOrBlob.size || 0);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: fileOrBlob
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    throw new Error(`[Cloudflare R2 - ${folder}] Échec du téléversement (${putRes.status}) : ${errText || putRes.statusText}`);
  }

  const publicUrl = `${cloudflareWorkerUrl}/file/${fullPath}`;
  return publicUrl;
}

/**
 * Rassembler un bucket (anciens "MonBucket" / "Chat") en paramètre folder.
 */
export type StorageFolder = "MonBucket" | "Chat";

/**
 * Compat : l'URL renvoyée par le Worker sert directement dans <img> / <a>.
 */
export function formatStorageUrl(url?: string | null): string {
  return url || "";
}