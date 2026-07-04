## Objective
Polish existing Renty codebase into launch-ready premium SaaS feel — no rebuild, no new features. Tighten visual system, interaction quality, and information hierarchy across the surfaces users already touch.

## Guardrails
- No new pages, no schema changes, no new dependencies.
- Terracotta + espresso tokens, Work Sans / Space Grotesk / JetBrains Mono stay locked.
- Business logic (booking, payment, verification, RLS) untouched.
- Malay-first copy preserved; only tighten wording where it's inconsistent.

## Workstreams

### 1. Design system hardening
- Audit `src/index.css` + `tailwind.config.ts`: remove duplicate `skip-to-main`, dedupe reduced-motion blocks, formalize spacing scale (4/8/12/16/24/32) and radius usage.
- Introduce two reusable surface utilities (`.surface-1`, `.surface-2`) + one elevation ramp so cards stop mixing `card-minimal`, `card-elevated`, ad-hoc shadows.
- Replace remaining hardcoded colors (`text-white`, `bg-black`, arbitrary hex) with tokens — sweep `components/` and `pages/`.
- Standardize focus ring, disabled state, and hover transitions across Button/Input/Select/Textarea.

### 2. Typography & rhythm
- Lock a type scale (display / h1–h4 / body / caption / mono-stamp) in `@layer base`; remove one-off `text-xl md:text-2xl` clusters in pages.
- Apply JetBrains Mono only to numeric/status stamps (price, IDs, countdowns, status pills) — audit `RentalCard`, `ItemDetail`, `Earnings`, `Dashboard`.
- Tighten line-height and letter-spacing on headings; ensure body copy is 15–16px on mobile.

### 3. Page-level polish (highest-traffic first)
- **Index (home)**: hero density, category strip spacing, featured items grid alignment, empty/skeleton parity.
- **Search**: filter chip clarity, sort control affordance, result card consistency, sticky mobile filter CTA.
- **ItemDetail**: image carousel controls, price block hierarchy (day/hour/deposit), owner card, sticky booking CTA on mobile.
- **Dashboard / MyListings / Earnings**: consistent section headers, table→card responsive pattern, empty states using `EnhancedEmptyState`.
- **Auth / VendorOnboarding**: step indicator alignment, form spacing, primary CTA weight, error states.
- **ListItem**: group fields into visual sections (Media / Basics / Pricing / Logistics), progress affordance, sticky submit polish.
- **Messages**: bubble spacing, timestamp treatment, composer height, attachment affordance.

### 4. Component consistency pass
- `Button`: verify every icon-only button has `aria-label`; standardize `size="icon"` to 44×44 on mobile.
- `Card` family: one padding scale, consistent header/body/footer rhythm.
- `Badge` / `StatusBadge` / `StatusStamp`: one color-mapping source of truth per status enum.
- `SkeletonCard` / `ListingsSkeleton` / `DashboardSkeleton`: match final layout dimensions so there's no layout shift.
- `EmptyState` vs `EnhancedEmptyState`: consolidate usage — pick one per context (list vs page).

### 5. Motion & micro-interactions
- Standardize on existing `animate-fade-in`, `hover-scale`, `story-link` utilities; remove ad-hoc `transition-all`.
- Add subtle press states to primary CTAs and cards (respecting `prefers-reduced-motion`).
- Page transitions via existing `PageTransition` applied consistently across routes.

### 6. Mobile-first refinements
- Verify 44px tap targets on bottom nav, filter chips, carousel arrows, icon buttons.
- Safe-area padding on all sticky CTAs (`ItemDetail`, `ListItem`, `Auth`).
- Pull-to-refresh presence audit on Dashboard / MyListings / Messages / Search.

### 7. Accessibility & SEO sweep
- Single `<main>` per route (move into layout if duplicated).
- Alt text on all `<img>` and `LazyImage` usage; label form inputs.
- `SEO` component values audited per page (title <60, desc <160, canonical, og).
- Contrast check on `text-muted-foreground` over `card` and `muted` surfaces.

### 8. Copy & microcopy
- Malay-first pass: unify button verbs (Sewa / Senaraikan / Simpan / Hantar), error toasts, empty-state copy.
- Currency formatting via one helper (`RM 0.00`, no locale drift).
- Date/time formatting unified (relative for <7d, absolute after).

## Sequencing
1. Design system hardening + typography (foundation — everything else inherits).
2. Component consistency pass (Button, Card, Badge, Skeleton, Empty).
3. Page polish in traffic order: Index → Search → ItemDetail → Dashboard/MyListings → ListItem → Auth/Onboarding → Messages → Earnings.
4. Motion + mobile refinements applied during page passes.
5. Final a11y + SEO + copy sweep.

## Non-Goals
- No new features, routes, tables, or edge functions.
- No changes to payment/booking/verification flows.
- No library swaps, no framework upgrades.

## Deliverable
A visibly tighter, more consistent app: unified tokens, one type scale, consistent cards/buttons/badges, cleaner page layouts, better mobile ergonomics, cleaner motion — same features, premium feel.

## Open Questions (please confirm before I start)
1. Start with **foundation first (design system + typography)** so every page inherits, or **page-by-page** starting with Index + ItemDetail?
2. Any page you consider off-limits (already happy with)? e.g. Auth, Admin.
3. OK to consolidate `EmptyState` + `EnhancedEmptyState` into one, and `card-minimal` + `card-elevated` into a single elevation ramp?
