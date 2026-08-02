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
