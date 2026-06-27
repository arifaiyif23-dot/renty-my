# Plan: Production Readiness & High-Impact Features

Implement everything discussed in 3 sequential phases. Each phase is shippable on its own.

## Phase 1 — Production Readiness (must do before launch)

1. **End-to-end payment test harness**
   - Add admin-only `/admin/health` page showing: latest payment_flow_logs, expired-payment cleanup status, payout queue, email delivery rate.
   - Add a "Test Payment" button (admin only) that creates a RM 1 test rental + bill against ToyyibPay to verify the full callback → payout chain.

2. **Email domain readiness check**
   - Add startup check in `send-email-notification` that warns if `RESEND_FROM_EMAIL` still contains `@resend.dev`.
   - Surface a banner in admin dashboard if production domain not verified.

3. **Encryption key guard**
   - Add SQL function `check_encryption_configured()` returning boolean.
   - Show warning banner in admin if `app.settings.encryption_key` not set (messages won't encrypt).

## Phase 2 — Payout Dashboard (owner-facing)

1. **`/earnings` page upgrade**
   - Summary cards: Total earned, Held in escrow, Pending payout, Paid out.
   - Payout history table with status timeline (held → pending → processing → paid).
   - Bank account management inline (add/edit/verify).
   - Export to CSV button.

2. **Edge function `request-payout-export`** to generate CSV for tax filing.

## Phase 3 — Dispute Resolution UI

1. **`/disputes` page** (both renter and owner views)
   - List of active disputes with evidence photos, timeline, messages.
   - Submit counter-evidence flow.
   - Admin resolution panel under `/admin/disputes` with: approve refund, release to owner, partial split.

2. **Email + in-app notifications** at each dispute state change.

3. **Review system polish** (small): only allow reviews after status `completed`, surface verified-rental badge on reviews.

## Technical Notes

- Reuse existing `payouts`, `disputes`, `payment_flow_logs`, `email_logs` tables — no schema changes needed except possibly a `dispute_messages` table in Phase 3.
- All new pages use existing `PageTransition`, `DashboardSkeleton`, `EnhancedEmptyState` components for consistency.
- Admin pages gated by `has_role(auth.uid(), 'admin')`.

## Out of Scope

- Sumsub migration (separate effort, needs credentials).
- Stripe escrow (ToyyibPay stays for MY market).
- Push notifications (PWA only for now).

Confirm and I'll start with Phase 1.
