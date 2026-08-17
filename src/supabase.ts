/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sanitizeUrl = (url?: string): string => {
  const fallback = "https://uefgeyokmhbovgrrxoje.supabase.co";
  if (!url || typeof url !== 'string') return fallback;
  let cleaned = url.trim().replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/$/, '');
  if (cleaned.startsWith('re_') || (!cleaned.startsWith('http://') && !cleaned.startsWith('https://'))) return fallback;
  return cleaned;
};

const sanitizeKey = (key?: string): string => {
  const fallback = "sb_publishable_fHZov5y-mAQQLdBg7ZfnFQ_3xji3Xpd";
  if (!key || typeof key !== 'string') return fallback;
  const cleaned = key.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return fallback;
  // If it's a Resend API key (re_...) or not a valid Supabase key format, fallback
  if (cleaned.startsWith('re_') || (!cleaned.startsWith('eyJ') && !cleaned.startsWith('sb_publishable_') && !cleaned.startsWith('sb_secret_'))) {
    console.warn("La clé dans VITE_SUPABASE_ANON_KEY n'est pas une clé Supabase valide. Utilisation de la clé de secours du projet.");
    return fallback;
  }
  return cleaned;
};

const supabaseUrl = sanitizeUrl(rawUrl);
const supabaseAnonKey = sanitizeKey(rawAnonKey);

export type BucketName = "MonBucket" | "Chat";

export const supabaseConfigError: string | null = null;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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


