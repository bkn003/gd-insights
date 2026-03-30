import { supabase } from '@/integrations/supabase/client';

/**
 * Extract the storage path from a stored URL (handles both old public URLs and raw paths).
 * Returns { bucket, path } or null if not a Supabase storage URL.
 */
const BUCKET_NAMES = ['gd-entry-images', 'gd-voice-notes', 'gd-images'];

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  
  for (const bucket of BUCKET_NAMES) {
    // Match pattern: /storage/v1/object/public/{bucket}/{path}
    const publicPattern = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(publicPattern);
    if (idx !== -1) {
      return { bucket, path: url.substring(idx + publicPattern.length) };
    }
    // Also match signed URL pattern: /storage/v1/object/sign/{bucket}/{path}
    const signPattern = `/storage/v1/object/sign/${bucket}/`;
    const idx2 = url.indexOf(signPattern);
    if (idx2 !== -1) {
      const pathWithQuery = url.substring(idx2 + signPattern.length);
      return { bucket, path: pathWithQuery.split('?')[0] };
    }
  }
  return null;
}

/**
 * Get a signed URL for a storage file. Falls back to the original URL if not a Supabase storage URL.
 * Signed URLs are valid for 1 hour (3600 seconds).
 */
export async function getSignedUrl(storedUrl: string, expiresIn = 3600): Promise<string> {
  const parsed = parseStorageUrl(storedUrl);
  if (!parsed) return storedUrl; // External URL, return as-is
  
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);
  
  if (error || !data?.signedUrl) {
    if (import.meta.env.DEV) console.warn('Failed to create signed URL:', error);
    return storedUrl; // Fallback
  }
  
  return data.signedUrl;
}

/**
 * Get signed URLs for multiple files in batch.
 */
export async function getSignedUrls(urls: string[], expiresIn = 3600): Promise<string[]> {
  // Group by bucket for batch signing
  const results: string[] = [...urls];
  const bucketGroups: Record<string, { index: number; path: string }[]> = {};
  
  urls.forEach((url, index) => {
    const parsed = parseStorageUrl(url);
    if (parsed) {
      if (!bucketGroups[parsed.bucket]) bucketGroups[parsed.bucket] = [];
      bucketGroups[parsed.bucket].push({ index, path: parsed.path });
    }
  });
  
  await Promise.all(
    Object.entries(bucketGroups).map(async ([bucket, items]) => {
      const paths = items.map(i => i.path);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, expiresIn);
      
      if (data && !error) {
        data.forEach((signed, idx) => {
          if (signed.signedUrl) {
            results[items[idx].index] = signed.signedUrl;
          }
        });
      }
    })
  );
  
  return results;
}

/**
 * Upload a file and return the storage path (NOT public URL).
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { cacheControl?: string; upsert?: boolean }
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: options?.cacheControl || '3600',
    upsert: options?.upsert || false,
  });
  if (error) throw error;
  
  // Create a signed URL for immediate use
  const { data: signedData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 3600);
  
  return signedData?.signedUrl || data.path;
}
