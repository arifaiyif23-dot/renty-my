## Plan: Renty 100% Production-Ready

Fokus: **hapuskan loose ends**, **UI lebih natural (kurang AI-look)**, dan **pastikan setiap function jalan end-to-end**.

---

### Bahagian 1 — Stability & Function Completeness (kritikal)

**1.1 Mesej end-to-end**
- Pastikan UI `Messages.tsx` baca `decrypt_message(encrypted_content)` via RPC, bukan column `content` mentah (untuk mesej baru selepas trigger encrypt).
- Fallback: kalau decrypt return NULL, paparkan `content` lama (pre-encryption messages).
- Fix realtime subscription supaya mesej baru terus decrypt.

**1.2 Rental flow audit (request → approve → pay → handover → return → payout)**
- Test setiap transition button: pastikan tiada button yang "dead" (klik tak buat apa).
- Sambung balik `RentalTimeline` ke `ItemDetail` / `Dashboard` rental detail view (sekarang component wujud tapi tak dipakai di mana-mana page).
- Tambah error toast yang jelas kalau edge function fail (bukan silent fail).

**1.3 Notifikasi payout lifecycle**
- Trigger DB: notify owner bila payout `held → pending → paid` (sekarang hanya ada notify untuk `held → pending`).
- Tunjuk estimated payout date di `Earnings.tsx` (cth: "Released within 3 days after rental ends").

**1.4 Search filter persistence**
- Simpan last-used filter di `localStorage` untuk `Search.tsx` (price range, category, location).

**1.5 Empty states bermakna**
- `Wishlist`, `Messages`, `MyListings`, `Dashboard (rentals tab)` — guna `EnhancedEmptyState` dengan CTA jelas (cth: "Browse items", "Create listing").

**1.6 Technical hygiene**
- Buang default `'your-encryption-key-change-this'` daripada `encrypt_sensitive_data` & `decrypt_sensitive_data` — bake real key (consistent dengan message encryption).
- Tambah retry/log untuk `notify_rental_changes` kalau `pg_net` fail.

---

### Bahagian 2 — UI: Kurangkan "AI-look", lebih natural

Sasaran: keluarkan tanda-tanda generic AI design (gradient ungu/biru berlebihan, emoji icon besar, badge "AI-powered", typography terlalu rounded).

**2.1 Homepage (`Index.tsx`)**
- Buang/kurangkan gradient mencolok di Hero. Guna solid background + 1 accent halus.
- Trust badges: tukar dari "shiny gradient pills" → flat minimalist row (icon + text kecil, no glow).
- Stats counters: padam animasi count-up kalau ada, guna nombor static dengan label kemas.
- `AnimatedCategoryIcon`: kurangkan gradient + glow, guna icon flat dengan border halus.

**2.2 Global tone**
- Audit `index.css` — kurangkan `--shadow-elegant` glow intensity, kurangkan saturation primary color sedikit.
- Buang badge "AI" / "Powered by AI" daripada UI user-facing (kalau ada di verification/admin yang ditunjuk pada user biasa).
- Tukar emoji headers (kalau ada) kepada lucide icons konsisten.

**2.3 Cards & components**
- `ItemCard` / `EnhancedItemCard`: shadow lebih halus, border 1px subtle, no gradient overlay kecuali atas image.
- `RentalCard`: status badge guna warna solid muted, bukan gradient.

**Tidak akan diubah:** brand color Renty, logo, layout struktur, mobile bottom nav.

---

### Bahagian 3 — Production polish

**3.1 Error & loading consistency**
- Semua mutation guna toast + haptic feedback yang konsisten (ada beberapa tempat masih guna native alert).
- Semua page lazy-loaded ada skeleton (bukan blank spinner).

**3.2 PWA & SEO sanity check**
- Pastikan `index.html` ada title, meta description, OG tags yang betul untuk Renty (bukan default Lovable).
- Manifest icon dah guna logo transparent terkini.

**3.3 Admin readiness**
- `AdminHealth` dashboard: pastikan semua metric live (encryption status, email delivery, cron jobs).
- Tambah "Test email" button untuk admin verify Resend domain berfungsi.

---

### Technical notes

- Tiada perubahan skema database besar — hanya 1 migration kecil untuk:
  - Update `encrypt_sensitive_data` / `decrypt_sensitive_data` bake key.
  - Tambah notification trigger untuk payout `pending → paid`.
- Tiada perubahan auth flow, payment flow, atau booking logic — hanya wiring + UI polish.
- Tiada package baru diperlukan.

---

### Urutan pelaksanaan (cadangan)

1. **Bahagian 1** dulu (function completeness — paling kritikal untuk "ready guna").
2. **Bahagian 2** (UI de-AI-fication).
3. **Bahagian 3** (final polish + admin sanity).

Boleh aku run sekali gus, atau pecah per-bahagian ikut kau nak.

**Sahkan untuk start, atau bagitau bahagian mana nak skip/utamakan.**