/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type BucketName = "MonBucket" | "Chat";

export let supabase: any = null;
export let supabaseConfigError: string | null = null;

function isValidHttpUrl(stringUrl?: string | null): boolean {
  if (!stringUrl || typeof stringUrl !== 'string') return false;
  try {
    const url = new URL(stringUrl.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

if (!supabaseUrl || !supabasePublishableKey) {
  supabaseConfigError = "Les variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY ne sont pas encore renseignées dans le projet.";
} else if (!isValidHttpUrl(supabaseUrl)) {
  supabaseConfigError = `L'URL Supabase spécifiée ("${supabaseUrl}") n'est pas une URL HTTP/HTTPS valide. Exemple attendu : https://xyzcompany.supabase.co`;
} else {
  try {
    supabase = createClient(supabaseUrl.trim(), supabasePublishableKey.trim());
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



