-- Remove the old directory search function.
--
-- public.directory_page (20261117) replaced it; nothing in the app calls
-- directory_search any more. Run this only AFTER the deploy containing
-- commit 0de713f ("Add sort options and status filters to the directory")
-- is live on Vercel.

drop function if exists public.directory_search(text, text, integer, integer);
