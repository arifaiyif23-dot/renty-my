# CURRENT_SYSTEM_AUDIT — RENTY (2026-08-02)

**Output Phase 1 (Implementation Plan):** System Audit
**Status:** ✅ HEALTHY — critical flows (auth, verification, lifecycle, booking, payment) all guarded server-side.

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
- CSP tightened: removed `unsafe-eval` + `cdn.jsdelivr.net` (confirmed live on renty.my)
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
1. **Apply migrations `20260807000005`?`20260807000010` to the remote DB** (untracked security hardening: RLS scope, encryption RPC lockdown, key rotation, message/bank at-rest). Last known good audit (2026-08-02) matched remote to 20260802000001; these 5 were popped AFTER. Apply via `npx supabase db push` (after `supabase link`) or dashboard SQL editor.
2. **Release-sign the APK** with the production keystore (`renty-release.jks` missing; only `renty-release-backup.jks` on disk) before store/distribution. Debug APK is self-signed (fine for devices).
