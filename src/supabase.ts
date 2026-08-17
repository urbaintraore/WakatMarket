/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type BucketName = "Bucket 2" | "chat";

const isValidUrl = (url: string | undefined) => {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

let errorMsg: string | null = null;
if (!supabaseUrl) {
  errorMsg = "La variable d'environnement VITE_SUPABASE_URL est manquante.";
} else if (!isValidUrl(supabaseUrl)) {
  if (supabaseUrl.startsWith("re_")) {
    errorMsg = `La variable d'environnement VITE_SUPABASE_URL contient une clé API Resend ('${supabaseUrl}') au lieu d'une URL de projet Supabase (qui doit ressembler à https://xyz.supabase.co). Veuillez corriger vos variables d'environnement.`;
  } else if (supabaseUrl.length < 50 && !supabaseUrl.includes(".") && !supabaseUrl.includes("/")) {
    errorMsg = `La variable d'environnement VITE_SUPABASE_URL '${supabaseUrl}' ressemble à une clé d'API ou un token plutôt qu'à une URL de projet Supabase (ex: https://xyz.supabase.co).`;
  } else {
    errorMsg = `La variable d'environnement VITE_SUPABASE_URL '${supabaseUrl}' n'est pas une URL de format valide (doit commencer par http:// ou https://).`;
  }
} else if (!supabaseAnonKey) {
  errorMsg = "La variable d'environnement VITE_SUPABASE_ANON_KEY est manquante.";
}

export const supabaseConfigError = errorMsg;

if (supabaseConfigError) {
  console.warn("Configuration de Supabase :", supabaseConfigError);
}

export const supabase = !supabaseConfigError && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Robust Supabase Storage uploader to a specific explicit bucket
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

  try {
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

    return { publicUrl: pubData.publicUrl, bucket };
  } catch (err: any) {
    console.error(`Error uploading to Supabase Bucket '${bucket}':`, err);
    throw err;
  }
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


