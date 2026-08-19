# RENTY - Project Guide

## Stack
React 18 + Vite 5 + TypeScript + Supabase + Tailwind CSS + shadcn/ui + React Router + TanStack Query + i18next + Playwright (E2E)

## Commands
- `npm run dev` — start dev server (port 8080)
- `npm run build` — production build + PWA generation
- `npm run typecheck` — TypeScript check (`tsc --noEmit`, must pass before deploy)
- `npm run lint` — ESLint
- `npm run test:e2e` — Playwright E2E tests (headless)
- `npm run test:e2e:ui` — Playwright UI mode
- `npm run test:e2e:headed` — Playwright headed mode
- `npm run verify` — pre-deploy verification script

## Key Files
- `src/contexts/AuthContext.tsx` — auth provider (Supabase session + profile)
- `src/types/index.ts` — shared types
- `vite.config.ts` — build config + PWA + code splitting
- `supabase/functions/` — edge functions (submit-verification, verify-document-ai, verify-ekyc, verify-admin, admin-operations)
- `supabase/migrations/` — DB migrations (apply in order via Supabase CLI)

## Architecture Notes
- Auth roles: `super_admin` > `admin` > `moderator` > `user`
- Verification flow: submit → AI document check → eKYC (optional) → admin review
- Image uploads: client-side sharp compression → Supabase Storage → item_images table
- All image CRUD in ListingEditDialog uses insert-then-delete pattern (no data loss)
- i18n uses `react-i18next` with Malay (ms) and English (en) locales
- Console.error is used on error paths (intentional for beta debugging)
- PWA: `src/sw.ts` custom injectManifest SW with NetworkFirst navigation + runtime caching for Supabase/fonts/images
- Use `self.clients.claim()` not `self.clientsClaim()` (latter is NOT a native SW API)
- `registerSW.js` does NOT use `{ type: 'module' }` — SW is a classic script
- `index.html` has `controllerchange` listener for auto-reload on SW update

## Completed Production Audit (July 2026)
- 15 critical bug fixes (touch events, auth redirects, audio, sanitization, SSR guards, etc.)
- 8 verification flow UX fixes (step navigation, validation, document viewer)
- TypeScript zero-error pass
- Dead code removal (BottomNavigation.tsx deleted, unused imports cleaned)
- Performance: query limits, image fallbacks, image insert-then-delete pattern
- Accessibility: aria-labels, keyboard nav, reduced-motion respect
- Form validation: `??` instead of `||` for zero values, phone validation
- Build passes, PWA precaches 60 entries (2.3MB)
- `.env.example` documents all required env vars
- SW registration fix: `self.clientsClaim()` → `self.clients.claim()` (non-native API caused eval failure)
- MyKad validation fix: regex 14-digit → 12-digit format, PLACE_CODES corrected to JPN standard
- PWA strategy: generateSW → injectManifest with NetworkFirst navigation (3s timeout), runtime caching for API/fonts/images
- `profiles` table has NO `email` or `role` column. Use `preferred_role` instead. Email lives in `auth.users` (service_role only).
- `verification_requests.document_front_url` etc. store storage paths like `uuid/front.jpg` (no bucket prefix). `DocumentViewerModal.extractPath` prepends `verification-documents/` before calling signed URL edge fn.
- Realtime on `profiles` needs REPLICA IDENTITY FULL (applied in migration `20260722000002`).

## Production Hardening (July 2026)
- **Search**: date-range ID query limited to 5000 rows to prevent OOM on large datasets
- **Payment**: server-side verification of payment status (no longer trusts URL params)
- **Double-click guards**: booking, OAuth, status change, bulk actions all guarded
- **Error handling**: stats silent errors fixed, profile skeleton-forever fixed, conversations error/empty distinction added
- **IC hash salt**: moved from hardcoded `'salt-change-this'` to `app.settings.ic_hash_salt` (migration `20260723000002`)
- **import_map.json**: centralized Deno dependency management for all 21 edge functions
- **Storage buckets**: defined in `config.toml` for local dev (item-images, avatars, verification-documents, rental-evidence)

## CI/CD
- `.github/workflows/ci.yml` — PR checks: typecheck + lint + build
- `.github/workflows/e2e-tests.yml` — E2E Playwright tests on push/PR to main/develop
- `.github/workflows/deploy.yml` — auto-deploy to Vercel on main push (requires `VERCEL_TOKEN` secret)
- GitHub Secrets required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VERCEL_TOKEN`

## Second Production Audit (July 2026) — Financial & Security Hardening
- **payment-callback**: replaced fake HMAC-SHA256 "signature" check with authoritative ToyyibPay `getBillTransactions` API verification; fail-closed (503) if verification unavailable; failure path guarded to not regress/cancel paid payments.
- **verify-ekyc**: disabled `kenal` provider (its `startEKYC` only *initiates* a session; `status==='success'` was self-approving KYC). Removed `verifyWithKenal`.
- **request-booking**: server-side price recomputation (price_per_day × days + tier discount + promo); rejects mismatched client price; `endDate >= startDate` + `YYYY-MM-DD` regex validation; single item fetch; min/max rental days enforced.
- **process-rental-approval**: overlap re-check before approve (prevents double-booking two overlapping pending requests).
- **resolve-dispute + admin-operations resolve_dispute**: refund now creates a real `payouts` row (status `pending`, recipient = renter) instead of a DB-only flag; rounded to cents with conservation; guarded status transitions; honest refund notification copy.
- **admin-operations process_payout**: status allowlist + `.in('status',['pending','held','awaiting_bank_details'])` guard → 409 on double-process; `handleAssignAdminRole` uses `auth.admin.listUsers()` (auth.users is NOT queryable via PostgREST); batch verify now sets `verification_level:'kyc'`.
- **create-payment**: legacy client-trusted flow removed (rentalId mandatory); payment inserted as `draft` → promoted to `pending` after ToyyibPay bill created (closes orphan-pending window); platform_fee rounded to cents; existing-open-payment check returns 409.
- **cleanup-expired-payments**: skips cancelling rentals that have a `paid` payment (TOCTOU); also expires stale `draft` payments.
- **complete-rental (new edge fn)**: server-side state-machine for owner completing/disputing a return (was a client-direct `rentals.update` bypass). Payout auto-created by DB trigger.
- **DB migrations**: `20260726000005_auto_payout_on_rental_complete` (trigger creates owner payout on rental→completed; partial unique indexes on payouts(rental_id,owner_id) and payments open per rental), `20260726000006_enforce_suspension_messages` (DB trigger blocks suspended senders).
- **Auth**: password-recovery flow implemented (AuthContext dispatches `renty:password-recovery`; Auth.tsx renders a set-new-password form); suspension enforced at login; `signOut` always clears local state; magic-link checks `setSession` result + restores intended destination.
- **Search**: `'all'` location sentinel no longer sent to DB (was silently emptying results); infinite-scroll race fixed (generation counter); `initialLoading` clears on empty results; SavedSearches location uses `ilike` + parallel counts.
- **Misc**: push VAPID key converted via `urlBase64ToUint8Array` + `unsubscribe()`; messages limited to 200 + IME Enter guard + optimistic unread reset; ReviewForm uploads images before insert; ListingEditDialog image save uses delete/insert/update-by-id (no duplicates); NotificationBell derives unread count + dedup; Earnings masked account number no longer written back; UserProfile items show with zero reviews; video liveness blob uses negotiated MIME; CORS tightened to FRONTEND_URL on magic-link + condition-report fns; verify-document-ai rate-limited (10/hr) + storage-URL allowlist (SSRF guard).
- **E2E**: playwright.config baseURL fixed to dev port 8080; auth/responsive/search specs rewritten to match the real UI (magic-link default, terms checkbox, id selectors).

## Mobile UI Tidiness Pass (July 2026)
Minimal Tailwind-only tweaks (no redesign, no theme/logic changes). All listing grids are **2-column on mobile**.
- **2-col grids**: `grid-cols-2 gap-3` at base in `NewestListingsSection`, `RecentlyViewedSection`, `Search`, `ItemDetail` (similar items), `MyListings`. `Wishlist` intentionally stays 1-col (uses swipe-to-delete).
- **`ListingCardV2`** compacted for narrow cards: `p-2.5`, `text-xs` title, smaller price/save/share/badge on mobile.
- **Sticky bars**: new `.bottom-mobile-nav` utility (`bottom: calc(4rem + safe-area)`) in `index.css` — `StickyBookingBar` now sits ABOVE `MobileBottomNav` (no overlap). Standardized `pb-mobile-nav` on `Dashboard`/`Earnings`/`MyListings`; `ItemDetail` uses `pb-44` to clear both bars.
- **Header**: removed duplicate mobile Search icon (bottom-nav "Browse" covers it); bottom-nav FAB `-mt-8`→`-mt-5`.
- **Hero/Search filters**: trust-badge row is `text-xs` with 2 items `hidden sm:inline-flex`; Search filter selects are `flex-1 min-w-0` (one even row on mobile); filter popover `w-[calc(100vw-2rem)]`.
- **Messages**: mobile thread height `100dvh-152px` so the input bar clears the bottom nav; removed duplicate safe-area padding on input.
- **Dashboard**: active-rental bulk checkboxes moved into a **selection mode** (Select/Done toolbar) instead of always floating over cards.
- **Touch targets**: `SearchBarV2` clear button `min-h/w-[44px]`; recent-search chips `min-h-[36px]`; all 6 Search filter-chip `X`s converted from SVG `role="button"` to real `<button className="p-1.5">`; SearchBarV2 location dropdown `max-w-[calc(100vw-2rem)]`.

## Responsive Layout Architecture (Desktop/Mobile Separation)
Single responsive codebase (no route/layout fork). Breakpoint `md` = 768px; CSS-first (Tailwind classes), `useIsMobile()` only for behavior branches (overlay search, drawer-vs-popover).
- **`PageLayout`**: `default`/`wide` = `max-w-7xl px-4 md:px-6 lg:px-8` (matches Header). `narrow`/`blank` unchanged. Footer is wrapped in `hidden md:block` — mobile chrome is the bottom nav, not a footer.
- **`Header`**: desktop navbar `md:h-16` with center inline `SearchBarV2 variant="inline"` (`hidden md:block flex-1 max-w-lg`) + nav links + "List Item" CTA. Mobile row unchanged (hamburger + logo + icons). Desktop nav links live in `desktopNavLinks` (List Item is the CTA button, not a nav link).
- **`ListingCard`** (the only listing card; `ListingCardV2` was consolidated into it): mobile compact by default, `lg:` desktop density added (`lg:p-5`, `lg:text-base` title, `lg:text-sm` meta/price). No separate desktop component.
- **Homepage** (`Index.tsx`) renders full marketplace sections: Hero → Categories → Newest → HowItWorks → WhyRenty → TrustStats → Testimonials → OwnerCTA → AppDownload (AppDownload wrapped in `md:hidden`). `NewestListingsSection` grid = `grid-cols-2 lg:grid-cols-4 xl:grid-cols-5`.
- **ItemDetail**: mobile stacked; desktop `md:grid-cols-12` — gallery span 7, sticky booking sidebar `md:col-span-5 md:sticky md:top-24`. Similar items moved to a full-width row after the grid (`lg:grid-cols-4`).
- **Search**: desktop `lg:` filter sidebar (w-72 sticky) + `xl:grid-cols-4` results; in-page `SearchBarV2` is `lg:hidden` on desktop (navbar covers it). Mobile uses `MobileFilterDrawer`.
- **Dashboard**: rental lists are `grid lg:grid-cols-2` on desktop. **Wishlist** `xl:grid-cols-4` (swipe-to-delete stays mobile-only via `useIsMobile`), removed its duplicate inner `container pb-mobile-nav` (PageLayout owns padding). **MyListings** `xl:grid-cols-4`.
- **SEO**: `SEO` component accepts optional `jsonLd` prop; homepage injects WebSite + SearchAction structured data.
- **Invariants**: `MobileBottomNav` stays global in App.tsx (`md:hidden`); `.pb-mobile-nav`/`.bottom-mobile-nav` zero out at md in index.css; Capacitor native always renders mobile chrome (viewport < md) — untouched.

## UI Revamp (July 2026)
- **Design language**: premium / minimal / calm. Deep-blue brand + glassmorphism. Radius = **two-tier** `rounded-lg` (12px, `--radius: 0.75rem`, controls) and `rounded-2xl` (16px, large cards) + `rounded-full` pills. `rounded-xl`/`rounded-md`/`rounded-sm` were merged into `rounded-lg` (they resolved to the same 12px via `--radius`). Shadow = **token scale only** `shadow-1..4` in `tailwind.config.ts` (theme-adaptive, uses `hsl(var(--foreground)/α)`); Tailwind defaults `shadow`/`-sm`/`-md`/`-lg` are banned (black-based, wrong in dark mode).
- **Homepage** (search-first, no 3D): Hero (`HeroSection.tsx`) is centered max-w-5xl with headline *"Don't buy everything. Rent what you need."* (all 4 locales), enlarged `SearchBarV2` (hero variant `h-14 md:h-16`) with a category `<select>` (7 options, default `all`, presets from `searchParams`), "List Your Item" CTA, items-available count + trust strip. `FloatingRentalObjects.tsx` + `public/models/*.glb` deleted. All section gradients/glows use brand tokens (`primary`/`success`/`action`/`warning`/`destructive`/`secondary`), never hardcoded Tailwind colors.
- **Light mode**: `--background: 220 20% 97%`, `--card`/`--popover: 220 25% 98%` (soft blue-white), bg-gradient bumps to 0.06 alpha. Dark `--secondary: 224 20% 16%`.
- **Auth**: glass card `bg-card/70 backdrop-blur-xl`, gradient blob decorations, brand-gradient right panel, `animate-fade-in` tab transitions.
- **Messaging fix** (Phase A, committed `2140d10`): encryption functions fall back to `platform_settings.encryption_key` (migrations `20260731000001/2`); `typing:` channel names are FNV-1a hashed (PostgreSQL LISTEN 63-byte limit).
- **Shared components** (reuse, don't re-implement): `PageHeader` (accent icon tile + title/subtitle), `RentalStatusBadge` (rental status → tinted pill, i18n labels), `LoadingSpinner` (full-screen). `.press` utility (index.css) = `transition-all active:scale-[0.98]` for tactile press feedback on non-button elements.
- `npm run verify` (typecheck + lint + build) must pass before deploy; deploy via `vercel --prod --yes`.

## Monitoring (recommended)
- **Vercel Analytics** — enable from Vercel dashboard (free, zero code)
- **Vercel Speed Insights** — enable from Vercel dashboard (free, zero code)
- **Supabase Logs** — edge function logs via Supabase dashboard
- **Errors table** — client-side errors logged to `public.errors` table, viewable via AdminErrors page
- Option: Sentry (free tier 5k events/month) for structured error tracking with source maps

## Security (August 2026 Hardening)
- **ENCRYPTION KEY ROTATION**: Old key `r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4` (visible in git history) is being replaced. New key starts with `AYw8ky3+`. Run `supabase/rotate-encryption-key.sql` in Supabase SQL Editor. The script: (A) fixes encrypt/decrypt fns (param renamed `key`→`p_key` + platform_settings fallback), (B) drops triggers temporarily, (C) re-encrypts messages + bank accounts, (D) recreates triggers, (E) verifies. All atomic in one transaction. Backup new key in a secrets manager (NOT in code/git).
- **pgBouncer note**: Supabase resets the `app.settings.encryption_key` GUC between statements (transaction pooling). All encryption functions MUST keep the `platform_settings` table fallback (see `20260731000001`, `20260731000008`, `20260807000010`, `20260819000001`). Never remove that fallback.
- **verify-admin**: Now has `verify_jwt = true` in config.toml (defense-in-depth)
- **Edge function validation**: verify-payment and admin-operations now use Zod schemas for input validation
