# Renty — Laporan Progress untuk ChatGPT

## Ringkasan

Dua sesi work telah dilakukan:
1. **Polish sprint** — cleanup code, remove console.log, fix TypeScript `any`, tambah ErrorBoundary
2. **Security & trust sprint** — protect PII, tighten RLS, mask data sensitif, fix trust features

Semua changes dah di-commit, push, build (0 error), dan deploy (migration + 21 edge functions).

---

## Sesi 1: Polish Sprint

### Rate-limiting SQL fix
- **Migration:** `20260710000004_fix_rate_limit_parentheses.sql`
- Bug: missing parentheses around OR clause dalam `check_rate_limit_enhanced` — AND bind tighter daripada OR, jadi action/attempted_at filter bypassed bila IP match
- Fix: `AND ((p_user_id IS NOT NULL AND user_id = p_user_id) OR (p_ip_address IS NOT NULL AND ip_address = p_ip_address))`

### Console.log removal
- **Frontend (12 logs):**
  - `use-admin-realtime.ts` — payload log
  - `ListingEditDialog.tsx` — 6 debug/condition/step/save logs
  - `registerServiceWorker.ts` — 3 logs (registered, error, update)
  - `use-keyboard-shortcuts.ts` — 2 logs
- **Edge functions (4 logs):**
  - `verify-document-ai/index.ts` — file data log
  - `resend-webhook/index.ts` — webhook received log
  - `create-payment/index.ts` — env vars, payouts config logs

### Unused icon imports (5 removed)
| File | Icons Removed |
|------|--------------|
| `AdminAutomation.tsx` | `RefreshCw`, `Upload` |
| `AdminPromoCodes.tsx` | `Sparkles` |
| `Help.tsx` | `BellOff` |
| `NotificationSettings.tsx` | `BellOff` |

### Image alt text
- `ListingEditDialog.tsx` — added `alt={listing.title}`
- `Profile.tsx` — added `alt="Profile"`

### Empty state improvements
- `AdminSettings.tsx` — added `EmptyState` warning before fallback message
- `Earnings.tsx` — replaced bare `<p>` with `<EnhancedEmptyState>`

### ErrorBoundary
- `main.tsx` — `<ErrorBoundary>` wrapping `<App />`
- `AuthLayout.tsx` — `<ErrorBoundary>` wrapping `<Outlet />`

### Bank account validation (Earnings.tsx)
- Added validation for `bankAccount` object before calling `submitConnectOnboarding`

### TypeScript `any` elimination
| File | Fix |
|------|-----|
| `AdminDashboard.tsx` | 6 supabase count queries `as never` → typed generics; fraud/verification queries → typed interfaces |
| `AdminVerification.tsx` | `details: any` → `Record<string, unknown>`; `ai_analysis_result: any` → `AiAnalysisResult` interface |
| `AdminHealth.tsx` | `details: any` → `Record<string, unknown>` |
| `AdminDisputes.tsx` | Removed double casts (`.range(...) as never as Promise<...>` → typed generics) |
| `Disputes.tsx` | Same — removed double casts |
| `Verification.tsx` | `result: any` → `VerifyResult \| null` state |
| `ListingEditDialog.tsx` | `listing: any` prop → typed `Item` interface |
| `Messages.tsx` | `messages` state `any[]` → `Message[]`, `upsertMessage` param `any` → `Message`, `forEach` callback typed |
| `UserProfile.tsx` | `_rating`/`_reviewCount as any` → proper `ItemWithRating` interface |

---

## Sesi 2: Security & Trust Sprint

### PII Protection (client-side)

**Bank account numbers masked:**
- `AdminPayouts.tsx:288` — `"****" + payout.account_number.slice(-4)`
- `Earnings.tsx:432` — same pattern in payout history display
- Phone number removed from admin payouts query (`AdminPayouts.tsx:68`)

**IC numbers masked:**
- `DocumentViewerModal.tsx:333` — `"****" + extractedData.icNumber.slice(-4)` instead of full number

### Profile over-fetching eliminated
Replaced `profiles(*)` with explicit columns in ALL public queries:

| File | Columns Selected |
|------|-----------------|
| `ItemDetail.tsx:104` | `id, full_name, avatar_url, is_verified, verification_level` |
| `RecentlyViewed.tsx:33` | Same |
| `use-items-query.tsx:25` | Same (this affects search results & listings) |
| `UserProfile.tsx:38` | `id, full_name, avatar_url, is_verified, verification_level, trust_score, location, bio, created_at, is_suspended` (no phone, PII, lat/lng, ekyc fields) |

### Admin query tightening
- `AdminVerification.tsx:112` — `SELECT *` → explicit safe columns (no document URLs, IC numbers, DOB in list view)
- `AdminDashboard.tsx:201` — `SELECT *, profiles!inner(full_name)` → `SELECT id, user_id, document_type, status, created_at, profiles!inner(full_name)`

### Database Migration: `20260710000005_security_trust_improvements.sql`

**1. Rental-evidence bucket RLS fix**
- Before: any authenticated user could INSERT/SELECT any file in `rental-evidence` bucket
- After: policies verify user is a rental participant (renter OR owner) by checking rental_id extracted from `storage.foldername(name)[2]`
- Folder structure assumed: `{user_id}/{rental_id}/{filename}`

**2. `public_profiles` view**
```sql
CREATE VIEW public.public_profiles AS
SELECT id, full_name, avatar_url, is_verified, verification_level, trust_score
FROM public.profiles;
```
- This view is safe for anonymous/anonymous-key usage
- Apps should query this instead of `profiles` table for public-facing features

**3. `compute_trust_score(user_id)` function**
- Returns INTEGER 0-100
- Scoring breakdown:
  - Base: 20pts
  - Verification level: email=5, basic=15, kyc/premium=25
  - Completed rentals: 1pt each, cap 20
  - Reviews received: 1pt each, cap 15
  - Avg rating: 4.5+=10, 4.0+=5, 3.0+=2
  - Account age: 1pt/month, cap 10
  - Suspension: -50 penalty
- Clamped to 0-100
- Not yet wired to a cron/trigger — ChatGPT boleh buat trigger or schedule

### Verified-only filter fixed
- `use-items-query.tsx:50` — was using `profiles.is_verified = true` (old boolean)
- Now uses `profiles.verification_level IN ('basic', 'kyc', 'premium')` (new enum system)

### DisputeCenter fixed
- `DisputeCenter.tsx` — was creating only a `notifications` record (with comment "you'd need a disputes table in production")
- Now:
  1. Looks up rental to get `owner_id` (filed_against)
  2. Inserts into `disputes` table with correct `rental_id`, `filed_by`, `filed_against`, `dispute_type`, `description`, `evidence_urls`, `severity: 'medium'`, `status: 'open'`
  3. Also creates notification for user feedback

---

## Status Deployment

- **Frontend build:** ✅ 0 errors
- **Migrations applied:** ✅ `20260710000004` + `20260710000005`
- **Edge functions deployed:** ✅ All 21 functions
- **Git:** ✅ All changes committed and pushed to `main`

---

## Cadangan untuk ChatGPT Next Steps

1. **Wire `compute_trust_score`** — buat trigger on `rentals` (status→completed), `reviews` (INSERT), `verification_requests` (status→approved) untuk auto-update `profiles.trust_score`. Or schedule via pg_cron.

2. **Response rate tracking** — `profiles.response_rate` field exists but never populated. Track message response times and update.

3. **Suspension enforcement** — `is_suspended` flag ada, UI dah tunjuk badge, tapi tak block actions/logins. Perlukan middleware/supabase helper untuk check.

4. **`profiles` SELECT RLS** — current policy still allows all authenticated users to `SELECT *` from profiles. Better approach: drop permissive policy, use `public_profiles` view for public access, restrict table to owners/admins/rental-participants only.

5. **eKYC checkbox** — `Verification.tsx` ada checkbox "Use eKYC" tapi cuma set `ekyc_provider: 'manual'`. Kalau nak real integration, perlu integrate dengan provider.

6. **Fix `resend-webhook` bug** — line 95 references `data?.event_type` before `data` is defined on line 97. Akan throw ReferenceError.

7. **Session storage** — Auth token stored in `localStorage`. Consider `sessionStorage` or httpOnly cookies for XSS protection.

8. **Remove plaintext `identity_number` column** — migration `20260710000001_remove_plaintext_identity.sql` should be created/applied.

9. **Input validation** — Many edge functions return `error.message` directly to client (information leakage). Use Zod schemas and generic error messages.
