import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'attachments';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error('Failed to list buckets:', listError.message);
  process.exit(1);
}

if (buckets.some((b) => b.name === bucketName)) {
  console.log(`Bucket "${bucketName}" already exists.`);
  process.exit(0);
}

const { error: createError } = await supabase.storage.createBucket(bucketName, {
  public: true,
  fileSizeLimit: '10MB',
});

if (createError) {
  console.error('Failed to create bucket:', createError.message);
  process.exit(1);
}

console.log(`Bucket "${bucketName}" created (public).`);
