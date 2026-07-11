# RENTY Design Proposal

## Current Issues

| Area | Issue | Severity |
|------|-------|----------|
| Color | No consistent palette — uses default shadcn/zinc colors | High |
| Branding | No logo icon (text-only "Renty" in header) | High |
| Typography | Uses system font stack, no hierarchy defined | Medium |
| Spacing | Inconsistent margins/padding across pages | Medium |
| Navigation | Header feels cluttered, CTA placement varies | Medium |
| Cards | ItemCard/RentalCard lack visual hierarchy | Medium |
| Empty states | Some have illustrations, others just text | Low |
| Dark mode | Exists but colors feel unpolished | Low |

## Design Direction

**Target:** Premium, luxury, trustworthy marketplace
**Vibe:** Apple simplicity × Airbnb usability × Uber clarity × Stripe trust
**Avoid:** Cheap gradients, cartoon icons, neon colors, glassmorphism everywhere

---

## 1. Color Palette

### Primary — Dark Green (trust, growth, rental ecosystem)

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#1A3C34` | Primary buttons, headers, active states |
| `--primary-light` | `#2D5A4E` | Hover states, secondary elements |
| `--primary-muted` | `#E8F0ED` | Subtle backgrounds, badges |
| `--accent` | `#C8A96E` | Gold accent for CTAs, highlights, premium badges |

### Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#FAFAF8` | Page background (warm off-white) |
| `--bg-card` | `#FFFFFF` | Card/surface backgrounds |
| `--text-primary` | `#1A1A18` | Body text |
| `--text-secondary` | `#6B6B67` | Secondary text |
| `--border` | `#E5E5E0` | Borders, dividers |
| `--border-hover` | `#D0D0CB` | Interactive border states |

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#2D6B4F` | Verified, completed, paid |
| `--warning` | `#B8860B` | Pending, attention |
| `--danger` | `#8B3A3A` | Errors, cancellations |
| `--info` | `#2B5F8A` | Info, updates |

---

## 2. Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-display: 'Playfair Display', Georgia, serif;  /* Luxury headings */
```

### Size Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-xs` | 0.75rem (12px) | 400 | Captions, badges |
| `--text-sm` | 0.875rem (14px) | 400 | Body, descriptions |
| `--text-base` | 1rem (16px) | 400 | Standard body |
| `--text-lg` | 1.125rem (18px) | 500 | Card titles |
| `--text-xl` | 1.25rem (20px) | 600 | Section headings |
| `--text-2xl` | 1.5rem (24px) | 600 | Page titles |
| `--text-3xl` | 2rem (32px) | 700 | Hero headings |

---

## 3. Logo Concepts

### Concept A: "R" Monogram with Leaf
- Minimal geometric "R" cut from a rounded square
- Negative-space leaf forming the upper-right of the "R"
- Single dark green (#1A3C34), works monochrome
- App icon: same mark centered

### Concept B: Two Arrows / Loop
- Two circular arrows forming an infinity-like loop
- Represents rental cycle (borrow → return)
- Gradient from dark green to gold

### Concept C: Simple Wordmark
- "renty" in a custom geometric sans-serif
- Lowercase, tight letter-spacing
- Accent dot replaces the crossbar of "t"
- Clean, modern, app-icon friendly

---

## 4. Screens Needing Redesign (Priority Order)

1. **Landing/Hero** — Needs premium hero with search, social proof
2. **Browse/Search** — Filter panel refinement, card grid spacing
3. **Item Detail** — Image gallery, booking CTA, trust signals
4. **Checkout/Payment** — Clean summary, clear CTA progression
5. **Profile** — Better info hierarchy, verification status visual
6. **Admin Dashboard** — Consistent card styling, data viz refinement
7. **Messages** — Cleaner chat bubbles, attachment previews
8. **Auth Flow** — Centered card, cleaner form inputs

---

## 5. Key UX Improvements

| Screen | Improvement |
|--------|-------------|
| Search | Sticky filter bar, persistent recent searches, skeleton while loading |
| Item Detail | Sticky "Book now" CTA on mobile, trust badges near price |
| Checkout | Stepped progress indicator (Request → Approve → Pay → Complete) |
| Profile | Visual verification badge, trust score meter |
| Messages | Typing indicator refinement, read receipts |
| Empty states | Consistent illustration style, actionable CTAs |
| Loading | Uniform skeleton pattern across all screens |

---

## 6. Component Audit

### Keep & Refine
- `Header.tsx` — needs spacing/color alignment
- `ItemCard.tsx` — needs price prominence, trust badge integration
- `SearchBar.tsx` — needs visual polish
- `ImageUpload.tsx` — needs progress indicator refinement
- `ErrorBoundary.tsx` — needs branded error screen

### Needs Rebuild
- `MobileNav.tsx` — bottom tab bar needs icon + label consistency
- `AdminSidebar.tsx` — collapsed/expanded states
- `FooterContent.tsx` (deleted — currently unused, may need revival)

---

## 7. Brand Voice

| Context | Tone |
|---------|------|
| Notifications | Warm, helpful ("Your item is booked!") |
| Errors | Calm, solution-oriented ("Something went wrong — we've been notified") |
| Empty states | Encouraging ("No items yet. List your first item →") |
| Verification | Trust-building ("Secure verification takes 2 minutes") |
| Payments | Clear, confident ("Your payment is protected by Renty's Deposit Shield") |

---

## Next Steps

1. **Approve/reject palette and typography choices** above
2. **Choose logo concept** (A, B, or C) or request refinements
3. **Approve screen priority order** for redesign
4. Implementation will begin after approval
