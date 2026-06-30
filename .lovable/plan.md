
# Plan: Renty Production Hardening

Fokus 3 priority + MCP connectors. Setiap perubahan kecil, surgical, tak break existing flow.

---

## 🔴 Priority 1 — Security Hardening

### 1.1 Encryption key sanity check
- Functions `encrypt_sensitive_data`, `decrypt_sensitive_data`, `encrypt_message_content`, `decrypt_message` sekarang dah guna **baked-in key** (`r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4`), bukan `app.settings.encryption_key`. Jadi tak akan break.
- Tambah **`encryption_self_test()`** SQL function: encrypt → decrypt round-trip dengan string sample, return boolean. `AdminHealth` panggil function ni, tunjuk badge ✅/❌ live.
- Tambah `pgcrypto` extension check (`SELECT * FROM pg_extension WHERE extname='pgcrypto'`) dalam `get_system_health_stats`.

### 1.2 Rate limiting (login & signup)
- Sudah ada table `rate_limits` + function `check_rate_limit_enhanced`.
- Wrap `signIn` / `signUp` dalam `AuthContext.tsx`: panggil RPC `check_rate_limit_enhanced` sebelum hit Supabase auth — 5 cubaan/15 min per email/IP. Kalau gagal, tunjuk toast "Terlalu banyak cubaan, cuba lagi 15 minit."
- Cron 1 jam sekali: `cleanup_old_rate_limits()`.

### 1.3 CAPTCHA signup
- Guna **hCaptcha** (free, Supabase native support — tak perlu Google reCAPTCHA SDK).
- Tambah hCaptcha widget dalam tab Signup `Auth.tsx`, hantar token ke `supabase.auth.signUp({ options: { captchaToken } })`.
- Perlu enable hCaptcha provider di Auth settings (akan guna `supabase--configure_auth` time build).

---

## 🟡 Priority 2 — UI De-AI-fication

Sasaran: macam Airbnb/Carousell — flat, muted, breathable. **Tak ubah brand color, logo, struktur nav.**

### 2.1 Global tone (`src/index.css`)
- Kurangkan saturation `--primary` ~10%.
- Tukar `--shadow-elegant` ke shadow flat halus (`0 1px 3px rgba(0,0,0,0.08)`).
- Buang `--gradient-*` tokens yang berkilat; ganti dengan solid muted surfaces.

### 2.2 Components yang akan disapu
| File | Perubahan |
|---|---|
| `Index.tsx` (Hero) | Buang trust-badge gradient pills → flat row icon+text. Padam emoji 🇲🇾/🔍 yang tak perlu. Stats: angka static, no count-up. |
| `AnimatedCategoryIcon.tsx` | Buang gradient + glow. Icon flat dengan 1px border `border-border`, hover `bg-accent/10`. |
| `EnhancedItemCard.tsx` / `ItemCard.tsx` | Shadow lebih halus, no gradient overlay (kecuali fade halus atas image utk readability badge). |
| `RentalCard.tsx` | Status badge solid muted (cth `bg-amber-100 text-amber-900` flat), no gradient. |
| `Button` variants | Audit — buang sebarang `shadow-lg`, `glow`, `bg-gradient-*` di custom usages (gunakan `variant="default"` standard). |
| `TrustBadges.tsx` | Flat row, icon kecil + text muted-foreground. |
| `SocialProofSection.tsx` | Padam animasi pulse berlebihan. |

### 2.3 Search filter persistence ✅ (sebahagian dah siap)
- `Search.tsx` dah simpan category/price/location/sort di localStorage.
- **Tambah:** radius/distance, search keyword (`q`), dan rehydrate bila navigate balik dari `ItemDetail`. Guna single key `renty:search:filters:v2` (versioned untuk avoid stale schema).

---

## 🟢 Priority 3 — Complete Flow & Automation

### 3.1 Admin Dispute Tools (enhance existing)
`AdminDisputes.tsx` dah ada — tambah:
- **Evidence timeline:** susun handover photos, return photos, chat excerpts (dari `messages` table, range tarikh rental) dalam vertical timeline kronologi.
- **Quick-action buttons:**
  - "Refund 100% renter" (preset)
  - "Split 50/50" (preset)
  - "Release to owner" (preset)
  - Custom amount (existing)
- Audit log: setiap resolve insert ke `admin_audit_log` dengan dispute_id, action, amount.
- Email kedua-dua party guna `send-email-notification` dengan template `dispute_resolved`.

### 3.2 Cron job: cleanup expired payments
- `cleanup_expired_payments()` SQL function dah wujud.
- Schedule via `pg_cron` setiap **5 minit** (insert tool, bukan migration sebab ada anon key).
- Tambah `AdminHealth` widget: "Last cron run" + "Next run in ...".

### 3.3 WebP image optimization
- `imageOptimization.ts` dah convert ke WebP — **verify** dipakai di SEMUA upload path:
  - `ListItem.tsx` (listing baru)
  - `ListingEditDialog.tsx` (edit)
  - `ProfileEditDialog.tsx` (avatar)
  - `HandoverDialog.tsx` / `ReturnDisputeDialog.tsx` (evidence)
  - `FileAttachment.tsx` (chat)
- Audit & sambung mana-mana yang skip `optimizeImage()`.

### 3.4 Verified email domain
- Cek status domain `renty.my` via `email_domain--check_email_domain_status`.
- Kalau verified: update secret `RESEND_FROM_EMAIL` = `notifications@renty.my` (guna `secrets--set_secret`).
- Kalau belum verified: panggil `email_domain--setup_email_infra` untuk `renty.my`, surface DNS records ke user.
- `send-email-notification`, `send-welcome-email`, `send-verification-email` dah baca `RESEND_FROM_EMAIL` env — auto-pickup.

---

## 🔌 MCP Connectors (yang masuk akal untuk Renty)

Akan suggest connect bila perlu, **bukan auto-connect semua** (waste). Yang relevan:

| Connector | Kegunaan dalam Renty |
|---|---|
| **Sentry** | Track runtime errors di production (payment fail, edge function crash) |
| **PostHog** | Funnel analytics: signup → list item → first booking → first payout |
| **Linear** | Auto-create issue bila admin tag dispute "needs eng review" |
| **Notion** | Knowledge base / SOP admin (rujuk masa training admin baru) |
| **n8n** | Dah ada (receipt webhook) — extend untuk auto-reminder owner approve booking |

Cron jobs scheduling masih guna `pg_cron` (native), bukan n8n.

**Aku akan:**
1. Suggest connect **Sentry + PostHog** dulu (paling impactful untuk production observability).
2. Yang lain optional — connect bila user request.

---

## Urutan pelaksanaan (cadangan)

1. **P1 Security** (encryption self-test, rate limit, hCaptcha) — 1 migration + Auth.tsx edit
2. **P3 Automation** (cron, WebP audit, email domain) — quick wins
3. **P2 UI** (de-AI-fication) — visual polish last, supaya kalau ada regression sambil tweak senang nampak
4. **P3 Dispute tools enhancement**
5. **MCP suggestions** (Sentry/PostHog)

Tiada perubahan auth flow, payment flow, atau booking logic — pure hardening + polish.

**Sahkan untuk start, atau bagitau bahagian mana nak skip/utamakan.**
