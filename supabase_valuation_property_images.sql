-- AssetX Estate - valuation property image storage
-- Run in Supabase SQL Editor before using image uploads on the valuation page.

ALTER TABLE valuations
  ADD COLUMN IF NOT EXISTS property_images JSONB DEFAULT '[]';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'valuation-images',
  'valuation-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "valuation_images_public_read" ON storage.objects;
CREATE POLICY "valuation_images_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'valuation-images');

DROP POLICY IF EXISTS "valuation_images_upload" ON storage.objects;
CREATE POLICY "valuation_images_upload"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'valuation-images');

DROP POLICY IF EXISTS "valuation_images_update" ON storage.objects;
CREATE POLICY "valuation_images_update"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'valuation-images')
WITH CHECK (bucket_id = 'valuation-images');

DROP POLICY IF EXISTS "valuation_images_delete" ON storage.objects;
CREATE POLICY "valuation_images_delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'valuation-images');
