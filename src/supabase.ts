/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = "https://uefgeyokmhbovgrrxoje.supabase.co";
const defaultSupabasePublishableKey = "sb_publishable_fHZov5y-mAQQLdBg7ZfnFQ_3xji3Xpd";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl)?.trim();
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || defaultSupabasePublishableKey)?.trim();

export type BucketName = "MonBucket" | "Chat";

export let supabase: any = null;
export let supabaseConfigError: string | null = null;

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err?.details || err?.error_description || err?.hint || err || '').toLowerCase();
  return (
    err?.name === 'TypeError' ||
    err?.name === 'AbortError' ||
    err?.code === 'PGRST301' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('abort') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('connection refused')
  );
}

function isValidHttpUrl(stringUrl?: string | null): boolean {
  if (!stringUrl || typeof stringUrl !== 'string') return false;
  try {
    const url = new URL(stringUrl.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const resilientFetch: typeof fetch = async (input, init) => {
  let attempts = 0;
  const maxAttempts = 2;
  let currentInit = init;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      const response = await fetch(input, currentInit);

      if (!response.ok) {
        const cloned = response.clone();
        try {
          const bodyText = await cloned.text();
          if (bodyText.includes("PGRST303") || bodyText.includes("JWT issued at future")) {
            console.warn(`[Supabase Fetch] Token JWT issu du futur (PGRST303, essai ${attempts}/${maxAttempts}). Attente de synchronisation de l'horloge...`);
            if (attempts < maxAttempts) {
              await new Promise(res => setTimeout(res, 1000 * attempts));
              continue;
            } else {
              console.warn("[Supabase Fetch] Suppression de la session obsolète et retentative sans en-tête d'autorisation...");
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && key.includes("sb-") && key.includes("-auth-token")) {
                    localStorage.removeItem(key);
                  }
                }
              } catch (e) {
                // ignore storage error
              }
              if (currentInit && currentInit.headers) {
                const headers = new Headers(currentInit.headers);
                headers.delete("Authorization");
                currentInit = { ...currentInit, headers };
                return await fetch(input, currentInit);
              }
            }
          }
        } catch (e) {
          // ignore clone reading error
        }
      }

      return response;
    } catch (err: any) {
      if (isNetworkError(err) && attempts < maxAttempts) {
        await new Promise(res => setTimeout(res, attempts * 300));
        continue;
      }
      throw err;
    }
  }
  return fetch(input, currentInit);
};

if (!supabaseUrl || !supabasePublishableKey) {
  supabaseConfigError = "Les identifiants Supabase (VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY) ne sont pas configurés.";
} else if (!isValidHttpUrl(supabaseUrl)) {
  supabaseConfigError = `L'URL Supabase spécifiée ("${supabaseUrl}") n'est pas une URL HTTP/HTTPS valide.`;
} else {
  try {
    supabase = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        fetch: resilientFetch
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    supabaseConfigError = null;
  } catch (err: any) {
    supabaseConfigError = `Erreur d'initialisation Supabase : ${err.message || err}`;
    console.error("Supabase initialization failed:", err);
  }
}

/**
 * Robust Supabase Storage uploader to a specific explicit bucket (MonBucket or Chat)
 */
export async function uploadToSupabaseStorage(
  bucket: BucketName,
  filePath: string,
  fileOrBlob: File | Blob,
  contentType?: string
): Promise<{ publicUrl: string; bucket: BucketName }> {
  if (!supabase) {
    throw new Error(
      `Supabase n'est pas configuré. Impossible d'uploader le fichier. ${supabaseConfigError || ""}`
    );
  }

  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileOrBlob, {
      cacheControl: '3600',
      upsert: true,
      contentType: contentType || (fileOrBlob instanceof File ? fileOrBlob.type : undefined)
    });

  if (uploadErr) {
    throw new Error(`[Supabase Storage - ${bucket}] Échec de l'upload: ${uploadErr.message}`);
  }

  const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  if (!pubData || !pubData.publicUrl) {
    throw new Error(`[Supabase Storage - ${bucket}] Impossible de récupérer l'URL publique après l'upload.`);
  }

  const publicUrl = formatStorageUrl(pubData.publicUrl);
  return { publicUrl, bucket };
}

/**
 * Ensures any Supabase storage URL has the correct '/public/' endpoint to avoid 400 errors.
 */
export function formatStorageUrl(url?: string | null): string {
  if (!url) return '';
  if (
    url.includes('.supabase.co/storage/v1/object/') &&
    !url.includes('.supabase.co/storage/v1/object/public/') &&
    !url.includes('.supabase.co/storage/v1/object/sign/')
  ) {
    return url.replace('.supabase.co/storage/v1/object/', '.supabase.co/storage/v1/object/public/');
  }
  return url;
}

/**
 * Robust Supabase Database Table Upsert (Throws errors to caller)
 */
export async function upsertToSupabaseTable(
  tableName: string,
  data: Record<string, any>
): Promise<void> {
  if (!supabase) {
    throw new Error(
      `Supabase n'est pas configuré. Impossible de synchroniser les données dans '${tableName}'. ${supabaseConfigError || ""}`
    );
  }

  try {
    const { error } = await supabase.from(tableName).upsert(data);
    if (error) {
      throw new Error(`[Supabase Database - ${tableName}] Échec de l'upsert: ${error.message}`);
    }
  } catch (err: any) {
    console.error(`Error upserting to Supabase table '${tableName}':`, err);
    throw err;
  }
}

/**
 * Robust Supabase Database Table Delete (Throws errors to caller)
 */
export async function deleteFromSupabaseTable(
  tableName: string,
  id: string
): Promise<void> {
  if (!supabase) {
    throw new Error(
      `Supabase n'est pas configuré. Impossible de supprimer dans '${tableName}'. ${supabaseConfigError || ""}`
    );
  }

  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
      throw new Error(`[Supabase Database - ${tableName}] Échec de la suppression: ${error.message}`);
    }
  } catch (err: any) {
    console.error(`Error deleting from Supabase table '${tableName}':`, err);
    throw err;
  }
}



