-- ============================================================================
-- Fasa B (Audit 2026-08-19): make rental-evidence bucket private.
--
-- The bucket was created public (migration 20251124131238) while the app uses
-- it for handover / return / condition-report photos (rented items + people in
-- frame). Public bucket => anyone with a (guessable) object URL can view them.
--
-- The app accesses these files via signed URLs (generate-signed-url edge fn,
-- which verifies rental participation). Making the bucket private keeps upload
-- + participant reads working while closing the anonymous read hole.
-- (config.toml already declares rental-evidence public = false.)
-- ============================================================================

UPDATE storage.buckets
SET public = false
WHERE name = 'rental-evidence';