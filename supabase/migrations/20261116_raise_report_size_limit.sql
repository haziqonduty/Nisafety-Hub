-- Reports now upload straight from the browser to Storage (through a
-- one-time signed link), so Vercel's ~4.5 MB request limit no longer
-- applies. Raise the bucket's per-file limit from 10 MB to 50 MB —
-- Supabase's free-plan maximum. Allowed file types are unchanged.

update storage.buckets
set file_size_limit = 52428800
where id = 'safety-documents';
