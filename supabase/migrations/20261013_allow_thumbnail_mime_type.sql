-- Run this file in the Supabase SQL Editor.
-- The safety-documents bucket's allowed_mime_types only included the three
-- document types; PDF thumbnails (image/jpeg) are uploaded by the
-- service-role client (not anon), so no RLS policy change is needed here —
-- only the bucket-level MIME allowlist, which applies regardless of role.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg'
]
where id = 'safety-documents';
