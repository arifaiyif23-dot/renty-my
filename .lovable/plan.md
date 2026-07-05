
# Renty Premium Refactor — Enforcement Plan

Goal: make the existing app match the three system docs exactly. No new features, no new flows, no new tables. Only refactor, remove, and standardize.

> ⚠️ **Major pivot flag**: current brand is *Earthy Terracotta + Espresso + Work Sans/Space Grotesk/JetBrains Mono*. Design System v2 mandates *Dark #0B1220 + Teal #14B8A6 + Inter only*. This plan replaces the current palette and typography wholesale. Confirm before I execute — this touches almost every screen visually but no logic.

---

## 1. Design Token Overhaul (`src/index.css`, `tailwind.config.ts`)

Replace all tokens with the v2 spec:

- `--background: 222 47% 9%` (#0B1220), `--card: 220 39% 11%` (#111827), `--popover/muted-surface: 217 33% 17%` (#1F2937)
- `--foreground: 210 20% 98%` (#F9FAFB), `--muted-foreground: 220 9% 46%` (#6B7280), secondary text #9CA3AF
- `--primary: 172 66% 40%` (#14B8A6) — sole accent
- `--success #22C55E`, `--warning #F59E0B`, `--destructive #EF4444`
- Remove terracotta, sage, ochre, brick, sand, paper tokens
- Force dark theme only in `App.tsx` (already `forcedTheme="dark"` ✓); delete light-mode `:root` variants beyond dark spec
- Fonts: import **Inter only**; drop Work Sans / Space Grotesk / JetBrains Mono imports and `font-heading` / `font-mono` families
- Type scale locked: H1 32/700, H2 24/600, H3 20/600, body 16/400-500, small 14, caption 12
- Shadow ramp: reduce to a single soft shadow (docs: *minimal shadows*); keep `--shadow-1` subtle, retire `--shadow-3`
- Spacing: enforce 8px grid — audit for arbitrary `p-3`, `gap-5`, `mt-7`, etc. and normalize to 1/2/3/4/6/8/12 (=4/8/12/16/24/32/48)
- Radius: keep `--radius: 0.625rem`
- Delete `.mono-stamp`, `.tabular` mono usage; numeric emphasis uses Inter tabular-nums instead

## 2. Component Cleanup

- **StatusStamp** (`src/components/StatusStamp.tsx`): rubber-stamp aesthetic violates *no decorative fonts / minimal*. Replace internals with a plain Badge (verified/pending/etc.) and keep the export as a thin shim so call sites don't break.
- **Badge / StatusBadge / VerificationBadge**: consolidate color mapping to teal + semantic only. Add a single canonical "Verified" pill used on cards + profiles.
- **Button**: enforce single primary CTA — audit pages with multiple `variant="default"`; downgrade extras to `secondary`/`ghost`.
- **Card**: standardize on `.surface-1`; remove terracotta hover tints.
- **Modal → Bottom sheet on mobile**: audit `Dialog` usages; swap to `Drawer` (already imported) on mobile breakpoints for non-critical dialogs (edit dialogs, filters, handover, dispute, return, rental modification, forgot-password). Keep center `AlertDialog` only for destructive confirms.
- **Input**: minimal border + subtle focus glow (already close, tighten ring opacity).
- **Skeletons**: verify every async surface has a matching skeleton (Home featured/nearby, Search grid, ItemDetail, Dashboard, MyListings, Messages list, Profile). Add where missing using existing `SkeletonCard` / `Skeleton`.

## 3. Page-by-Page Trust + Conversion Pass

For each, remove anything not answering trust/conversion/clarity/friction/mobile:

- **Index (Home)**: search bar top → category chips → nearby → featured. Kill hero banners, promo blocks, social-proof marketing sections, referral CTAs on home. Single primary CTA = search.
- **Search**: full-width search, chips, results grid. Ensure AutocompleteSearch + MobileFilterDrawer are the only filter surfaces. Remove desktop-only sidebar noise on mobile.
- **ItemDetail**: order → gallery (4:3 or 1:1) → **price dominant** → availability → owner (name + avatar + rating + verified) → trust signals → single primary "Request Rent" CTA sticky bottom. Move secondary actions (share, save) to ghost icons.
- **Rent Request**: keep one-screen sheet (duration → price breakdown → pickup → send). No multi-page wizard. Verify no extra decisions.
- **Request Status (Dashboard / RentalCard)**: every status shows next action. Pending → Cancel; Accepted → Chat + Pickup; Rejected → "See similar".
- **Messages**: enforce chat only unlocks after request; hide global compose. Tie header to listing thumbnail.
- **Profile**: reframe as trust dashboard — trust score, verification level, rentals count, listings, reviews. Remove social-feed patterns (followers, activity feeds if any).
- **Add Listing (ListItem)**: keep single flow, ensure ≤ 2 min. Audit for optional-field bloat; collapse advanced into a single "More options" disclosure.
- **Auth / VendorOnboarding**: single primary CTA per step, teal only, remove decorative marketing copy.
- **Admin pages**: apply tokens only; no UX rework (internal tool).

## 4. Listing Card Rules (`EnhancedItemCard`, `ItemCard`, `RentalCard`)

- Image aspect **4:3 or 1:1** (fixed) via `AspectRatio`
- Price is largest text (Inter, tabular-nums, semibold)
- Title 2nd priority (single line, truncate)
- Location muted 14px
- Trust badge (verified) always rendered when applicable
- Remove terracotta accents, decorative borders, category ribbons

## 5. Motion + Performance

- Durations 120–180ms, ease-out only; remove `float`, `pulse-glow`, bouncy scale animations from tailwind config keyframes usage on production surfaces (keep in config but unused)
- Skeleton mandatory (see §2)
- LazyImage everywhere images render; blur placeholder confirmed
- PageTransition kept ≤180ms

## 6. Removals (Simplification Rule)

Delete or hide from UI (keep files if referenced elsewhere):

- Home marketing sections that aren't discovery: `SocialProof`, `SocialProofSection`, `TrustBadges` marketing strip, `ReferralSystem` on Home, `FeaturedItems` decorative wrappers if redundant
- Any gamification-styled badges
- Hero gradients, glassmorphism, decorative floats
- Legacy classes `.card-minimal`, `.card-elevated`, `.mono-stamp` (keep as no-op aliases one release to avoid breakage, then remove in a follow-up)

## 7. Accessibility + Mobile

- Verify 44px tap targets globally (already partially enforced via `@media (pointer: coarse)`)
- Safe-area bottom on sticky CTAs (ItemDetail request bar, Auth submit)
- Contrast AA against #0B1220 for all text + badges
- Single `<main>` per route (already ✓)

## 8. Audit Output (delivered after implementation)

I'll return four lists per the doc's Output Requirement:
1. UI/UX issues found
2. Improvements made (file-by-file)
3. Remaining inconsistencies
4. Further optimization suggestions

---

## Technical execution order

```text
1. Tokens + fonts + tailwind config    (foundation)
2. Primitive components (Button, Card, Badge, Input, Skeleton, StatusStamp shim)
3. Listing card family
4. High-traffic pages: Index → Search → ItemDetail → Dashboard
5. Secondary pages: ListItem, Messages, Profile, MyListings, Earnings, Auth, Onboarding
6. Modal→Sheet migration on mobile breakpoints
7. Removal pass (Home marketing sections, decorative animations)
8. Audit report
```

## Out of scope (per user directive)

- No new features, routes, tables, edge functions, or flows
- No changes to payments, escrow, verification logic, moderation, i18n keys
- No admin UX redesign beyond token application

## Confirm before I start

The palette + font pivot is destructive to the current terracotta brand. Reply **"go"** to proceed exactly as above, or tell me which parts to hold (e.g. keep terracotta but adopt everything else).
