# CURRENT_SYSTEM_AUDIT — RENTY (2026-08-20)

**Output Phase 1 (Implementation Plan):** System Audit
**Status:** ✅ PRODUCTION-READY (pending email SMTP setup) — all code/security hardening complete. B4 encryption key backed up to Vault. Email SMTP via Resend still requires manual DNS setup.

---

## 1. Overview

| Area | Status | Notes |
|------|--------|-------|
| Auth (session, profile, suspension) | ✅ | `AuthContext` single source; realtime profile sync; suspension enforced at login; `signOut` always clears state |
| Password recovery | ✅ | Recovery link → `/auth` → new-password form via `renty:password-recovery` event |
| Verification gates | ✅ | Client gates (ItemDetail/ListItem/VendorOnboarding) **+** server gate in `request-booking` (rejects unverified) |
| Protected routes | ✅ | `ProtectedRoute` (auth) + `AdminRoute` (edge-fn `verify-admin`, 15s timeout, abort) |
| Item lifecycle | ✅ | `item_status` ENUM + `check_item_status_transition` trigger — enforces allowed transitions + logs to `item_status_history` |
| Anti double-booking | ✅ | Atomic RPC `create_rental_with_overlap_check` (TOCTOU-safe) + re-check in `process-rental-approval` |
| Payment trust | ✅ | `payment-callback` verifies via ToyyibPay `getBillTransactions` (fail-closed 503); `create-payment` draft→pending |
| Migrations | ✅ | Local = Remote (all 151, incl. `20260802000001` rental times) |
| Edge functions | ✅ | All critical fns ACTIVE (request-booking v19, process-approval v18, payment-callback v22, etc.) |

## 2. Auth & Verification (Phase 2 scope — PRE-AUDIT)

- Signup: `signUp()` → supabase auth + welcome email (non-blocking) + terms version stamp
- Login: rate-limited (5/15min), suspension check, error mapping
- Magic link: rate-limited (3/15min), edge fn `send-magic-link`
- Admin: `AdminRoute` → `verify-admin` edge fn (role: super_admin > admin > moderator > user)
- Verified gate server-side: `request-booking` line 132 `if (!profile?.is_verified)` → 403

**No critical gaps found.** Minor: `AdminRoute` no re-verify on route change (acceptable for SPA).

## 3. Item Lifecycle (Phase 3 scope — PRE-AUDIT)

- ENUM: `created → under_review → available → paused/reserved → pickup_pending → active_rental → return_pending → inspection_pending → available/maintenance/damaged/lost`
- Trigger `trg_check_item_status` BEFORE UPDATE — rejects illegal transitions, writes history
- `(NEW.status = 'lost')` — any → LOST allowed
- Index: partial `idx_items_status WHERE status = 'available'` — search-optimised
- Overlap: `create_rental_with_overlap_check` RPC — atomic insert guard

**No critical gaps found.** Minor: `inspection_pending → damaged` exists; `damaged → lost` via any→lost.

## 4. Booking & Payment (Phase 4/5 pre-check)

- `request-booking`: server-side price recompute, min/max days, promo validation, overlap RPC, instant-book flag
- `process-rental-approval`: re-validate availability, status allowlist
- `create-payment`: draft → pending promotion, 409 on open payment, platform fee rounded
- `payment-callback`: ToyyibPay API verification (not client-trusted), fail-closed

## 5. Recommendations (non-blocking)

1. `AdminRoute` — optional: re-verify on window focus (role changes mid-session)
2. Consider DB-level check on `complete_rental` owner identity (currently edge-fn guarded — fine)
3. `npm audit` baseline: 2 high (Next.js advisories are for Next; this is Vite — verify PostCSS upgrade path)

## 6. Phase 2/3 Deep Audit Results (2026-08-02)

### Phase 2 — Auth & Verification: ✅ NO CRITICAL GAPS
- `submit-verification`: auth check, suspension check, rate limit (3/hr), ownership check (`eq user_id`) — solid
- RLS: `items` SELECT public / INSERT+UPDATE+DELETE owner-only; `user_roles` view-own + admin-manage; `item_status_history` RLS enabled
- `verify-admin` edge fn: checks `user_roles` for admin/super_admin/moderator — not client-trustable
- ProtectedRoute + AdminRoute (edge-fn verified, 15s abort timeout) — solid
- Note: file scan found `***` display artifacts in tool output only — confirmed NOT in source (0 `***` byte sequences in edge fn files)

### Phase 3 — Item Lifecycle: ✅ NO CRITICAL GAPS
- Status machine: `item_status` ENUM + `check_item_status_transition` BEFORE UPDATE trigger (rejects illegal transitions, writes `item_status_history`)
- Item ↔ rental sync: `update_item_status_on_rental_change` trigger — reserved→`reserved`, confirmed→`pickup_pending`, active→`active_rental`, completed→`inspection_pending`, cancelled/rejected→`available` (only if no other active rental)
- Overlap RPC (latest `20260802000001`): **status list CORRECT** (`payment_pending/reserved/confirmed/active` — matches new ENUM), time-aware (pickup/return times), advisory-lock serialized, `requested` intentionally excluded (SOP design)
- Client status changes all go through DB triggers (MyListings archive/pause, AdminListings toggle) — cannot bypass machine
- Booking event logger: `log_booking_event` trigger writes `booking_events` on every status change

## 7. Phase 4-7 Deep Audit Results (2026-08-02)

### Phase 4 — Booking System: ✅ NO CRITICAL GAPS
- `process-rental-approval`: owner-only + suspension check; **status guard `reserved` with atomic update** (`.eq('status','reserved')` + check returned row — TOCTOU proof); **time-aware overlap re-check before approve** (rejects double-booking); **agreement mandatory** (approve requires `rental_agreements` row); reject → **auto refund payout** (real `payouts` row, pending) + notifications
- `cancel-booking`: renter-only, status allowlist `[requested, payment_pending, reserved]`, atomic guard, reserved→refund payout
- `expire_stale_bookings`: requested → 30min, payment_pending → 30min, reserved → 48h (auto-cancel, cron)

### Phase 5 — Payment System: ✅ NO CRITICAL GAPS
- `payment-callback`: **authoritative ToyyibPay `getBillTransactions` verification** (never trusts URL params); **fail-closed** (verification unavailable → 503, no auto-approve); `.eq('status','pending')` on all updates (no double-process); paid → rental `reserved` only from `payment_pending`; failed → payment `failed` + rental `cancelled`; full `payment_flow_logs` trail
- `create-payment`: Zod validation; rental must be `requested` + renter-only; **promo validated server-side** (active/expiry/max_uses/per-user); **`acquire_payment_lock` RPC** (anti double-process); **idempotency key** (retry-safe); **price from DB not client** (`rental.total_price`); platform fee from `platform_settings`; 409 on existing open payment; 24h expiry

### Phase 6 — Deposit: ✅ covered by payment/payout flow (deposit in `payments.deposit_amount` tracked; release via `resolve-dispute`/`complete-rental` creating real `payouts` rows)

### Phase 7 — Handover & Return: ✅ NO CRITICAL GAPS
- `confirm-handover`: owner-only, status `confirmed` guard, **pickup-code verification** (4-digit), handover photos, atomic `status: 'active'`
- `submit-inspection`: owner-only, `inspection_pending` guard, result allowlist `[available, maintenance, damaged, disputed]`, RPC transition (respects item status machine)
- `complete-rental` edge fn: server-side state machine (owner confirms/disputes return) — no client-direct `rentals.update` bypass

## 8. Phase 8-10 Audit Results (2026-08-02)

### Phase 8 — Vendor Dashboard: ✅ NO GAPS
- `IncomingRequests`: reserved-only filter, approve/reject via `process-rental-approval` edge fn (not client-direct), confirm dialog, toasts
- `RentalCard`: status labels + colors + icons (confirmed/active/overdue/completed...), review entry when completed
- `MyListings`: stats (total/active/revenue/views), archive/pause via DB trigger (respects status machine), grid/list views, selection mode + bulk actions
- `Earnings`: stat cards, payout list, bank account required banner, pending payouts

### Phase 9 — Admin Dashboard: ✅ NO GAPS
- 14 routes: dashboard, verifications, users, listings, rentals, payments, payouts, disputes, reports, promo-codes, settings, automation, health, manage-admins — all wrapped in `AdminRoute` (edge-fn verified)
- `AdminVerification`: pending queue, approve/reject dialogs with rejection reason, batch actions — all via `admin-operations` edge fn
- All admin mutations server-side (admin-operations edge fn + auth.admin.listUsers for auth.users)

### Phase 10 — UX Polish: ✅ NO GAPS
- Loading states: all 48 pages with async data have LoadingSpinner/Skeleton/Loader2 (12 without are static pages — Terms/Privacy/Help/About/Install/NotFound/Offline — no data fetch, correct)
- Empty states: EmptyStateV2/AuroraEmptyState with CTAs (no raw "No data")
- Navigation: Header (desktop: Home/Browse/About + auth-gated Messages/Dashboard) + MobileBottomNav (Home/Browse/List/Messages/Profile) — all paths resolve, auth-gated
- Previous UI passes (DESIGN_SYSTEM V2 compliance, touch targets, glass rules) already committed

## Mobile + Web Final Audit � 2026-08-09 ? VERIFIED
**Scope:** full static + runtime audit of Capacitor app and renty.my after the mobile rework wave. All findings fixed, committed (`6d6b2e3`), and deployed (prod = https://renty.my, alias live).

### Mobile fixes (all applied)
- **C1** Messages conversation list `100vh` ? `100dvh` (list ran under bottom nav) � `Messages.tsx:431`
- **C2** New Android **hardware-back handler** (`App.tsx`): closes open dialog/sheet/drawer/overlay (Escape bridge) ? router back ? else `App.minimizeApp()`
- **Medium:** ListItem sticky footer `-mx-6`?`-mx-4` (h-overflow on =360px); ConditionReportWizard checklist stacks `flex-col sm:flex-row`; BulkActionsBar / PWAInstallPrompt / ScrollToTop moved ABOVE the bottom nav via `calc(4rem+safe-area+�)`; ReviewsList rating row `flex-wrap`
- **Minors (~20):** 44px targets (dialog/sheet close, ImageUpload remove, FileAttachment clear, EmojiPicker, Search chips/filter X, ConditionReportWizard zoom link, ScrollToTop, MobileSearchOverlay Clear), PTR `touchcancel` handler, `85vh`?`85dvh`, drawer safe-area bottom, `70vh`?`70dvh`, Wishlist PTR indicator moved to fixed overlay, OfflineIndicator below header, theme-color `#2851E3`
- **Hero regression found & fixed:** homepage had NO `h1` (lazy Hero lost its headline) � restored "Don't buy everything / Rent what you need." in all 4 locales; search-browse + accessibility E2E rewritten for lazy headings + mobile filter button (now has `aria-label="Filters"`, was unlabeled icon-only)

### Web / security fixes (all applied)
- Sourcemaps OFF (new deploys ship no `.js.map` under `dist/assets/`)
- CSP tightened: removed `unsafe-eval` (live); `cdn.jsdelivr.net` removed from vercel.json (commit 6e3982d) — no code uses it
- Duplicate `<link rel="manifest">` removed (plugin single-inject � confirmed 1 link live)
- SEO default og:image ? `https://renty.my/og-image.png` (was an Unsplash stock photo)
- `document.documentElement.lang` synced to i18n language; unused `Chunk.{ttf,otf}` fonts deleted; aria-labels on 8+ icon-only controls (NotificationSettings/SavedSearches back, AdminErrors expand/delete, AdminVerification shortcuts, AdminHealth email, MyListings bulk checkbox)
- `*.apk` added to .gitignore; stale root `app-release.apk` removed (keystore signing remains user-side)

### Tests executed
- typecheck / lint / madge-circular / `npm run verify` (all 5 checks) � **PASS**
- Horizontal-overflow scan: 20 routes � Pixel5/iPhone12 � **ZERO overflow**
- Playwright (auth-free, chromium + Mobile Chrome): accessibility, responsive, search-browse � **18/18 PASS**
- auth.spec (validation): 4/4 PASS
- Live-site sweep (renty.my): 10 routes � **0 page errors, 0 console errors**; h1 present; single manifest link; CSP tightened live
- item-listing/profile/admin E2E: **BLOCKED by Supabase signup 429 rate limit** (known infra limitation; CI auto-run disabled) � reruns need a stable pre-created test account

### APK / device
- Fresh APK built with Java 21 (Android Studio JBR): `android/app/build/outputs/apk/debug/app-debug.apk` (also copied to `app-debug.apk` at repo root)
- **Emulator test NOT possible on this machine:** x86_64 AVD requires Android Emulator Hypervisor driver (not installed; cannot auto-install)
- **ON-DEVICE checklist (user):** install `app-debug.apk` ? verify (1) hardware Back closes dialogs ? then returns; (2) camera permission prompts (listing photos, VideoLiveness); (3) haptics on pull-to-refresh; (4) numeric keyboard on pickup code; (5) bottom nav + PWA prompt placement; (6) offline banner + retry; (7) GCM push registration banner.

### Remaining manual items
1. **Migrasi remote — APPLIED ✅ (2026-08-09):** `20260807000005`…`00010` diaplikasi melalui `supabase db push` (CLI tersambung ke `gsucsqtqtpaeuxwrykmf`, pengesahan akhir: *Remote database is up to date*). `20260804000001` + `20260807000001`…`00004` rupanya **sudah berada** di remote (hanya 5 terakhir yang kurang). Untuk kegunaan lintas-lingkungan, `00005` kini dijaga `to_regclass()` (seksyen `owner_earnings` dilangkau jika jadual tak wujud) dan `00006` `GRANT`s dijaga dengan pangkalan `pg_proc` — sengaja kukuh idempotens. Nota: putaran kekunci (`00007`) dan backfill plaintext (`00008`/`00010`) kekal no-op (memerlukan sesi `set app.*` oleh pengendali) — ini adalah sengaja.
2. **Release APK — RESOLVED** (2026-08-09): `android/renty-release.jks` + `android/keystore.properties` present dan berfungsi. `app-release.apk` (5.6 MB, R8-minify, signed CN=Renty, SHA-256 `d17bdfd6…`) dibina dan disalin ke repo root. Ready untuk kedai / edaran. Nota "keystore hilang" yang sebelum adalah salah — ia berada di disk sepanjang masa.

## 11. Phase B Security Hardening (2026-08-20)

All changes committed and deployed. Commits: `c0a800c`, `1ff4617`, `e109091`, `4110cc7`, `546d3e5`, `6e3982d`.

### B1 — Private storage + signed-URL display
- `rental-evidence` bucket: **public=false** (was public; any URL with UUID could view photos)
- `uploadEvidence` now stores paths (`rental-evidence/${fileName}`) instead of raw File references
- 5 components refactored: `HandoverDialog`, `ReturnDisputeDialog`, `ConditionReportWizard`, `RentalDetail`, `RentalCard`, `ReturnConditionComparison` — all use `useSignedUrls` hook / `getEvidenceUrl` helper
- `complete-rental` zod schema accepts paths (validated, committed separately)

### B2 — payment-callback per-bill token
- `payments.callback_token` column (UUID, generated in `create-payment`)
- `create-payment` embeds `?cb_token=<uuid>` in ToyyibPay callback URL
- `payment-callback` validates token via `safeEqual` (constant-time) + billcode match; rejects if either fails
- Closes vector: guessing billcode alone no longer triggers false payment confirmation

### B3 — Rate limits on edge functions
- RPC `check_rate_limit_track` (SECURITY DEFINER, `GRANT service_role`): atomic check+insert, fail-open
- `_shared/ratelimit.ts` — `enforceRateLimit()` + `RateLimitError` (429 JSON)
- Applied to 8 abuse-prone functions: `generate-signed-url` (240/10min), `create-payment` (20/10min), `request-booking` (30/10min), `confirm-handover` (30/10min), `complete-rental` (30/10min), `process-rental-approval` (60/10min), `process-modification` (60/10min), `submit-condition-report` (60/10min)
- `cleanup-rate-limits` cron: `cleanup_old_rate_limits()` every 6h (jobid 6), deletes records >7 days

### B5 — CORS / verify_jwt / CSP
- CORS audit: no wildcard origins; all use `FRONTEND_URL`; webhook fns (email/push/resend) use shared-secret fail-closed
- `verify_jwt=true` enforced on 4 client-called functions (previously config.toml drift): `verify-admin`, `admin-operations`, `submit-condition-report`, `complete-rental`
- CSP: `cdn.jsdelivr.net` removed from `script-src` in `vercel.json` (no code loads from it)

### IC hash salt (critical)
- **Before:** `hash_ic_number()` fell back to a publicly-known salt (`r3nty_ic_salt_2026_...`, committed in git history) when the GUC was unset; on prod the GUC was NULL — all IC hashes trivially reversible offline
- **After:** random 32-byte salt generated at migration time, stored in `platform_settings.ic_hash_salt`; function uses GUC → platform_settings → RAISE (fail-closed, no known fallback)
- Legacy `verification_requests.ic_number_hash` and `profiles.identity_number_hash` NULLed (no code reads them; computed with public salt — lossless)
- Same pgBouncer rule as encryption key: keep `platform_settings` fallback

### Operator actions remaining
1. **B4 — RESOLVED** (2026-08-20): Encryption key backed up to Supabase Vault (`vault.secrets`, name `renty_encryption_key`, id `0eb3022e`). Recovery: `SELECT vault.decrypt_secret(id) FROM vault.secrets WHERE name = 'renty_encryption_key';` then UPDATE platform_settings. Old compromised key `r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4` in git history — cannot be removed, but no longer used.
2. **Email delivery** (from earlier audit): Custom SMTP via Resend still pending — Supabase Auth emails won't deliver reliably until configured. See `docs/SETUP_EMAIL_SMTP.md`.

## Sign In / Sign Up Flow � Seamlessness + Email Delivery (2026-08-09)
**Root cause (confirmed):** confirmation emails for new signups were sent by Supabase Auth's built-in mailer (`mailer_autoconfirm = false` verified via `/auth/v1/settings`), with NO custom SMTP configured on the project � so emails were rate-limited/delayed/lost. Additionally all app emails (magic link, welcome) go through Resend using `onboarding@resend.dev` + a send-only API key, which only delivers to the Resend account owner � real users never received them either.

**Code changes (committed):**
- `Auth.tsx` signup ? confirmation screen now has: **Resend confirmation email** (`supabase.auth.resend`, 60s cooldown, `check_rate_limit` 3/60min), spam-folder hint, **"I've confirmed � Sign me in"** (auto-login with entered credentials), and **auto-detection** � polls `getUser()` up to 2 min and logs the user in the moment `email_confirmed_at` is set (works cross-tab via shared origin storage).
- `Auth.tsx` login ? "Email not confirmed" now renders an **inline amber panel** with Resend + dismiss (instead of a dead-end toast).
- `ForgotPasswordDialog` ? added spam hint + resend with 30s cooldown.
- `.env` ? added `VITE_SITE_URL="https://renty.my"` so confirmation/reset links resolve to the real site (and not `capacitor://localhost` on native). NOTE: `.env` is gitignored � mirror in Vercel/GH-actions env.
- E2E `auth.spec` 4/4 pass with new UI; `npm run verify` 5/5; release APK rebuilt with the changes.

**REQUIRED operator action to finish delivery (dashboard, cannot be scripted):**
1. Resend ? Domains: add `renty.my`, follow DNS records until Verified.
2. Set `.env`/Vercel `RESEND_FROM_EMAIL="Renty <no-reply@renty.my>"` (or the verified address).
3. Supabase ? Authentication ? SMTP Settings: enable custom SMTP � Host `smtp.resend.com`, Port `587`, Username `resend`, Password = Resend API key, Sender `Renty <no-reply@renty.my>`.
4. Optional: temporarily set Auth ? Email ? "Confirm email" OFF for instant signup if delivery can't wait.
After that: signup confirmation, password reset, and magic links all deliver reliably from the own domain.
