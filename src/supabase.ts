/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: string | undefined) => {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

export const supabase = isValidUrl(supabaseUrl) && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

/**
 * Robust Supabase Storage uploader trying multiple common bucket names ('chat', 'public', 'uploads', 'documents')
 */
export async function uploadToSupabaseStorage(
  filePath: string,
  fileOrBlob: File | Blob,
  contentType?: string
): Promise<{ publicUrl: string; bucket: string } | null> {
  if (!supabase) return null;

  const candidateBuckets = ['chat', 'public', 'uploads', 'documents', 'media'];

  for (const bucket of candidateBuckets) {
    try {
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileOrBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: contentType || (fileOrBlob instanceof File ? fileOrBlob.type : undefined)
        });

      if (!uploadErr) {
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        if (pubData?.publicUrl) {
          return { publicUrl: pubData.publicUrl, bucket };
        }
      } else {
        console.warn(`Supabase storage bucket '${bucket}' upload note:`, uploadErr.message);
      }
    } catch (e: any) {
      console.warn(`Supabase bucket '${bucket}' error:`, e?.message || e);
    }
  }

  return null;
}

/**
 * Robust Supabase Database Table Upsert
 */
export async function upsertToSupabaseTable(
  tableName: string,
  data: Record<string, any>
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from(tableName).upsert(data);
    if (error) {
      console.warn(`Supabase table '${tableName}' upsert error:`, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`Supabase table '${tableName}' sync failed:`, err?.message || err);
    return false;
  }
}

/**
 * Robust Supabase Database Table Delete
 */
export async function deleteFromSupabaseTable(
  tableName: string,
  id: string
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
      console.warn(`Supabase table '${tableName}' delete error:`, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`Supabase table '${tableName}' delete failed:`, err?.message || err);
    return false;
  }
}

