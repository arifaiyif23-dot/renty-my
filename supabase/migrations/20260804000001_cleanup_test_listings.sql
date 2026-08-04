-- ============================================================================
-- RENTY: Cleanup test listings (2026-08-04)
-- ----------------------------------------------------------------------------
-- Masalah: listing test ("test sewa iphone" RM1/day deskripsi "test",
-- "dji osmo") masih live di production dan kelihatan di homepage/browse.
-- Ini merosakkan kepercayaan pengguna baru.
--
-- Selamat: semua FK children (item_images, saved_items, rentals, dll)
-- guna ON DELETE CASCADE, jadi delete items akan membersihkan dependent rows.
-- Item yang nampak real (cth "SYM HUSKY 150") TIDAK disentuh.
-- ============================================================================

BEGIN;

-- 1. Kenal pasti item test
CREATE TEMP TABLE _test_items AS
SELECT id, title, price_per_day
FROM public.items
WHERE title ILIKE 'test%'
   OR title ILIKE '%test sewa%'
   OR title ILIKE '%test item%'
   OR description ILIKE '%test%'
ORDER BY created_at;

-- 2. Log apa yang akan dibuang (output migration log)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM _test_items LOOP
    RAISE NOTICE 'cleanup_test_listings: deleting item % ("%", RM%)', r.id, r.title, r.price_per_day;
  END LOOP;
END $$;

-- 3. Delete (cascade membersihkan item_images, saved_items, rentals dll)
DELETE FROM public.items i
USING _test_items t
WHERE i.id = t.id;

-- 4. Bersihkan temp
DROP TABLE _test_items;

COMMIT;

-- Nota: imej yang masih tinggal dalam Supabase Storage (bucket item-images)
-- untuk listing yang dipadam perlu dibuang manual via dashboard/storage,
-- atau run script cleanup storage. DB rows dah bersih.
