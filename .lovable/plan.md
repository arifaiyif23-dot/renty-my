
## Plan — Align Renty dengan blueprint (rebrand + T&C + hybrid payment)

Fokus: apa yang kau confirm — **rebrand**, **T&C + PDPA**, dan **payment dua pilihan (escrow + manual)** dengan launch category **motor, kamera, baju event**. Escrow ToyyibPay yang dah live tak dibuang.

---

### 1) Rebrand — Terracotta + Espresso + Stamp language

**Design tokens (`src/index.css`)** — tukar HSL supaya semua semantic token align:
- `--primary` → terracotta `#C1552C` (hsl 15 63% 47%)
- `--foreground` / ink → espresso `#2B211A`
- `--background` → paper `#FAF3E7`
- `--card` → sand `#F0E6D2`
- `--secondary` / info → sage `#5C6B5E`
- `--success` / confirmed → moss `#5B7048`
- `--warning` / pending → ochre `#C98A2C` (tambah token baru)
- `--destructive` → brick `#8C2F26`
- Dark mode variant guna espresso-deep base, terracotta glow lebih muted.

**Typography**:
- Body/UI kekal sans (Inter/DM Sans yang dah loaded).
- Tambah `font-mono` = JetBrains Mono dalam `tailwind.config.ts` untuk stamp elements. Buang font unused (Crimson Pro, Merriweather, Lora, Inconsolata, Poppins) supaya bundle kecil.

**Logo & assets** — tak sentuh (kau baru upload).

**StatusStamp component** (baru — `src/components/StatusStamp.tsx`):
- Rotate ringan (-3° hingga -6°), dashed/double border, uppercase mono kecil.
- Variants: `verified`, `pending`, `confirmed`, `rejected`, `founding-vendor`.
- Guna kat: `StatusBadge`, `VerificationBadge`, listing card overlay, RentyScore chip, dispute status.

**Category cards** (`AnimatedCategoryIcon.tsx`) — differentiate **guna ikon sahaja**, buang warna berbeza per kategori (align brand identity Section 5). Semua guna terracotta/ink monochrome.

---

### 2) T&C, Privacy, PDPA consent flow

**Halaman baru**:
- `/terms` — render `TERMS_AND_CONDITIONS.md` sebagai page (parse markdown, jaga heading). Tambah banner atas: “Draft — pending legal review”.
- `/privacy` — spinoff Section 11 PDPA + data retention, subprocessor list (Supabase, Resend, ToyyibPay), user rights (akses/pembetulan/pemadaman).
- Footer link kepada kedua-dua page.

**Consent flow**:
- `Auth.tsx` signup form → tambah checkbox wajib: “Saya bersetuju dengan Terma & Syarat dan Dasar Privasi Renty” + link.
- Simpan `terms_accepted_at`, `terms_version` di `profiles` (migration).
- Verification/e-KYC page → tambah PDPA notice khusus KYC (retention, consent explicit untuk dokumen identiti).
- Update AuthContext `signUp` supaya reject kalau checkbox tak ditick.

**PDPA data-subject request**:
- `/profile` → tambah section “Data & Privasi” dengan butang **Request data export** dan **Request account deletion** (log ke jadual `data_requests`, admin resolve manual buat masa ni — sejajar dengan ADDENDUM #4 style).

---

### 3) Payment: dua pilihan (escrow default + manual sementara)

Kau nak dua pilihan. Escrow ToyyibPay tak dibuang. Owner boleh opt kepada **manual (bank/DuitNow QR)** untuk listing dia — sesuai dengan STRATEGY Phase 1.

**Schema (migration)**:
- `items.payment_mode` enum baru: `escrow` (default) atau `manual`. Owner set masa create/edit listing.
- `owner_bank_accounts` — reuse untuk simpan DuitNow QR ref/nombor akaun yang akan ditunjuk kepada renter kalau manual.
- `rentals.payment_mode` snapshot bila booking dibuat.
- `rentals` tambah `manual_payment_proof_url`, `manual_payment_confirmed_at`, `manual_payment_confirmed_by` (owner-side confirmation).

**UI flow — manual**:
- `ListItem.tsx` → radio pilih payment mode. Default escrow (recommended). Manual tunjuk warning: “Renty tak pegang duit — kau uruskan bayaran dengan renter sendiri, deposit vendor-hold.”
- Selepas owner approve request:
  - Escrow → flow sedia ada (`create-payment` → ToyyibPay).
  - Manual → tunjuk kepada renter modal “Pay owner”: akaun bank + QR + jumlah. Renter upload bukti transfer.
  - Owner dapat notification, tekan **Confirm payment received** → rental jadi `paid` (skip ToyyibPay).
- Commission 10% untuk manual: dijana sebagai **invoice** dalam `payouts` (status `owner_owes_platform`) — admin follow-up manual (sejajar STRATEGY_ADDENDUM #1).

**Guard rails**:
- Dispute flow sedia ada boleh handle kedua-dua (bukti manual = upload proof).
- Kalau manual mode, hide countdown expiry (sebab bukan ToyyibPay).

---

### 4) Launch categories — motor, kamera, baju event

**Bukan buang category lain** — cuma highlight tiga ni sebagai focus category.

- `Index.tsx` Hero → featured category row: Motor · Kamera · Baju Event dengan icon terracotta besar. Category lain masih boleh browse via search.
- Tambah kategori baru `party_wear` (baju event) dalam schema enum kalau belum ada, atau reuse `party` category (yang existing). Semak dulu — reuse kalau boleh.
- SEO meta di homepage: “Sewa motor, kamera & baju event di Klang Valley.”
- Search page: default sort feature 3 kategori ni dulu.

---

### 5) Founding Vendor tag (ringan)

Sejajar STRATEGY Section 4 tapi keep minimal:
- `profiles.founding_vendor boolean` (migration).
- Admin panel tambah toggle untuk tag vendor.
- `StatusStamp` variant `founding-vendor` (terracotta stamp) tunjuk kat profile page & listing card.
- Commission override: kalau `founding_vendor = true` dan rental_count < threshold, `commission_rate = 0`. Buat masa ni just tag + display, backend commission logic tak diubah (kau boleh flip switch lepas ni).

---

### Technical notes

- Semua tukar warna via CSS variable, **tak sentuh** komponen (tiada hardcode hex).
- Migration urutan: `payment_mode` enum + `items` column + `rentals` columns + `profiles.terms_accepted_at` + `profiles.founding_vendor` + `data_requests` table + GRANTs.
- Markdown page render guna `react-markdown` (tambah dependency) atau inline JSX kalau nak elak dep baru — cadang inline JSX untuk control styling.
- T&C content copy verbatim dari file kau, tapi wrap dengan banner draft.
- Bilingual: buat page T&C dalam BM sahaja dulu (source of truth), tambah EN toggle Phase 2.

---

### Deliverables

1. Migration: enum `payment_mode`, columns baru (items/rentals/profiles), `data_requests` table, GRANTs.
2. `src/index.css` + `tailwind.config.ts` rebrand tokens.
3. `StatusStamp` component + integration kat StatusBadge/VerificationBadge/listing card.
4. `/terms`, `/privacy` pages + footer links + signup consent checkbox.
5. `ListItem.tsx` payment mode selector + manual bank details capture.
6. Renter “pay owner” modal (manual) + owner “confirm received” action di Dashboard.
7. Homepage hero highlight 3 launch categories.
8. Founding vendor tag + admin toggle + StatusStamp display.
9. Category icon monochrome pass.

Nak aku start? Kalau ya, aku implement in this order supaya tak break flow existing.
