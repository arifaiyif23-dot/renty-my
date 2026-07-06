# Renty Production Hardening Sprint — Plan

This is a multi-pass audit + fix sprint. No new features. Every change targets reliability, error handling, and UX polish on existing flows.

I'll work in the order below, committing per priority so you can preview between passes.

---

## P1 — Identity Verification (Critical)

### 1a. Liveness Video Pipeline
**Root-cause investigation targets**
- `supabase/functions/verify-document-ai/index.ts` and `submit-verification/index.ts` — check timeouts, sync vs async processing, large base64 payloads.
- `src/components/VideoLivenessCapture.tsx` — chunked encoding, upload progress, cancel/retry.
- `verification_requests` schema — ensure fields exist for `processing_status`, `processing_error`, `last_status_update`.

**Fixes**
- Convert liveness processing to **async job pattern**: edge function returns `202` immediately, `EdgeRuntime.waitUntil` runs analysis, writes status to `verification_requests`.
- Frontend polls status every 3s with a 90s hard timeout → shows retry.
- Chunked base64 encoding (8KB) to avoid `String.fromCharCode` argument limits on large videos.
- Modularize: extract a `LivenessProvider` interface (current: internal Gemini; future: Sumsub) — swap without touching UI.
- Progress states: `idle → uploading (% bar) → processing (spinner + elapsed) → completed / failed (retry CTA)`.

### 1b. Document Verification (MyKad + video)
- Audit `submit-verification` upload path → verify signed URL, bucket policy on `verification-documents`, size/mime validation.
- Fix preview: `generate-signed-url` must return short-lived URL and frontend must handle 404/expired.
- Add explicit per-file states in `Verification.tsx`: `queued/uploading/uploaded/failed` with per-file retry.
- Validate DB row is created BEFORE upload finishes so admin queue never has orphan files.

### 1c. Admin Verification
- `AdminVerification.tsx` + `verify-admin` + `send-verification-email` audit.
- Use two-client pattern in edge functions (user client validates RLS, service_role client mutates).
- On approve/reject: update `verification_requests.status`, trigger already updates `profiles.is_verified`.
- Ensure **Realtime** publication includes `verification_requests` and `profiles` so badges refresh with no page reload.
- Fix known bug in `send-verification-email`: Resend `from` field format (currently returns 422 — visible in edge logs).

---

## P2 — Payment System (ToyyibPay, kept — not Stripe)

Renty runs on **ToyyibPay FPX** per project memory. I will NOT migrate to Stripe (that would be a rebuild). I'll harden the existing ToyyibPay flow to production quality. If you actually want Stripe migration, say so and I'll replan.

**Audit + fix**
- `create-payment` — idempotency: reuse active pending bill if `expires_at > now`, otherwise create new.
- `payment-callback` — signature verification already on; add idempotent status transition (guard against duplicate callbacks).
- `cleanup-expired-payments` — verify cron is firing; log to `payment_flow_logs`.
- `PaymentSuccess.tsx` — handle: paid / pending / failed / expired / unknown states with clear CTAs.
- Race condition guard: wrap rental + payment status update in DB function (atomic).
- Orphan check: payments with no matching rental → surface in `AdminHealth`.

---

## P3 — UX Audit (per-screen sweep)

Screens: Index, Search, ItemDetail, ListItem, Dashboard, MyListings, Messages, Profile, Verification, Earnings, Disputes, Admin*.

For each: verify loading skeleton, empty state, error state, success toast, mobile layout, keyboard focus, dark mode contrast.

Deliverable: fix list committed inline (no separate doc).

---

## P4 — Loading States

- Every `useQuery` / `supabase.functions.invoke` gets: skeleton or spinner, timeout (30s default), error toast, retry button.
- Replace any bare `<Loader2 />` full-screen with a page skeleton where the layout is known.
- Add `AbortController` to long fetches.

## P5 — Error Handling

- Central `handleError(err, context)` util → toast + Sentry-style console structure.
- All edge function calls wrapped with try/catch + user-facing message.
- No `.catch(console.error)` without user feedback.

## P6 — Production QA

- Ripgrep sweep: broken imports, dead components, `TODO`/`FIXME`, hardcoded colors that survived design pass.
- Route audit: every `<Link>` and `navigate()` target resolves.
- Image audit: alt text, lazy-loading, fallback for broken storage URLs.
- React audit: missing keys, unstable deps, unnecessary re-renders (React DevTools patterns).
- Console/network: fix all warnings and 4xx/5xx on happy path.

---

## Execution Order (commits)

```text
1. P1a Liveness async pipeline + retry
2. P1b Document upload + preview fixes
3. P1c Admin approve/reject + realtime badge sync + Resend from-field fix
4. P2  ToyyibPay hardening (idempotency, atomic updates, PaymentSuccess states)
5. P4+P5 Loading/error primitives + wire into all invokes
6. P3  Screen-by-screen UX sweep
7. P6  Final QA pass + report
```

Each commit is independently previewable. After the last commit I'll deliver the report: **bugs found → root cause → fix → remaining debt → pre-launch recommendations**.

---

## Decisions I need from you

1. **Payments**: Keep ToyyibPay (recommended — matches memory + MY market) or actually migrate to Stripe? Stripe = major rewrite, ~2–3 full passes.
2. **Liveness provider**: Keep Gemini-based custom verification for now (with async fix) and prep the `LivenessProvider` interface for Sumsub later — confirm this is fine, or should I skip the interface and just fix in place?
3. **Scope of "UX sweep"**: full every-screen pass (long) or only the flows that touch P1/P2 (verification, booking, payment, dashboard)?

Reply with answers (or "all defaults: ToyyibPay, modular interface, full sweep") and I'll switch to build mode and start with P1a.
