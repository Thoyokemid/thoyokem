import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'attachments';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // matches the bucket's configured 10MB limit

// Whitelist only — the bucket is public-read, so an unlisted type (e.g. text/html,
// image/svg+xml) served back to a browser via its public URL could execute as
// stored XSS. Extend this list deliberately, not by removing the check.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export async function uploadToSupabaseStorage(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('Ukuran file maksimal 10MB');
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Tipe file tidak didukung');
  }

  const path = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, fileBuffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Deletes a file from storage given its public URL (as returned by uploadToSupabaseStorage). */
export async function deleteFromSupabaseStorage(fileUrl: string): Promise<void> {
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(fileUrl.slice(idx + marker.length));

  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) {
    // Non-fatal: the DB row is still the source of truth for what's "attached" —
    // log so an orphaned storage object can be cleaned up manually if needed.
    console.error('Error deleting file from Supabase Storage:', error);
  }
}
