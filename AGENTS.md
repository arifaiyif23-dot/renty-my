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

## Monitoring (recommended)
- **Vercel Analytics** — enable from Vercel dashboard (free, zero code)
- **Vercel Speed Insights** — enable from Vercel dashboard (free, zero code)
- **Supabase Logs** — edge function logs via Supabase dashboard
- **Errors table** — client-side errors logged to `public.errors` table, viewable via AdminErrors page
- Option: Sentry (free tier 5k events/month) for structured error tracking with source maps
