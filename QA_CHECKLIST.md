# RENTY — Manual QA Checklist

**URL:** https://renty.my
**Date:** July 2026

---

## A. Auth Flow

- [ ] Signup with email -> check confirmation email -> login -> verify redirect
- [ ] Login with invalid credentials -> error toast with specific message
- [ ] Google OAuth -> loading spinner on button, redirect works
- [ ] Logout -> redirect to `/`
- [ ] Forgot password -> reset email -> new password works

## B. Listing Flow

- [ ] Create listing (all fields, images) -> save as draft -> verify in MyListings
- [ ] Publish draft listing -> verify appears in search results
- [ ] Edit listing (change price, category, replace images) -> save
- [ ] Delete listing (no rental history) -> removed completely
- [ ] Delete listing (with rental history) -> archived, not removed
- [ ] Bulk action (activate/pause/delete) -> toast success

## C. Search & Filter

- [ ] Search by keyword -> results load with skeleton
- [ ] Filter by category -> results update
- [ ] Filter by price range -> results update
- [ ] Filter by location -> results update
- [ ] Advanced filters (verified only, instant book, condition) -> works
- [ ] Date range -> available items only (paginated correctly)
- [ ] Clear all filters -> resets everything
- [ ] Save search -> appears in Saved Searches
- [ ] Infinite scroll -> loads next page

## D. Item Detail & Booking

- [ ] Item detail page -> all sections load (images, description, vendor, reviews)
- [ ] Select dates -> price breakdown shown
- [ ] Apply valid promo code -> discount applied
- [ ] Apply invalid promo code -> error toast, input preserved
- [ ] Request booking (non-instant) -> pending in dashboard
- [ ] Instant book -> immediate confirmation
- [ ] Handle own item (owner) -> booking button hidden

## E. Payment

- [ ] Payment success page -> receipt with server-side verification
- [ ] Countdown before auto-redirect -> visible to user
- [ ] Payment failed -> error screen with redirect

## F. Messages

- [ ] Start conversation from item detail -> message thread opens
- [ ] Send message -> optimistic UI, read receipt ✓✓
- [ ] Unread badge -> updates after reading
- [ ] Error fetching conversations -> error state (not empty state)

## G. Profile & Dashboard

- [ ] View profile -> stats load, trust score, verification status
- [ ] Edit profile (avatar, name, phone) -> saves correctly
- [ ] Dashboard tabs (active/pending/past) -> correct data per tab
- [ ] Select rentals -> bulk complete/cancel -> toast
- [ ] Error loading stats -> toast shown

## H. Verification

- [ ] Upload documents -> progress bar, step rollback on error
- [ ] Submit verification -> "Under Review" status

## I. Admin

- [ ] Login as admin -> dashboard loads with stats
- [ ] Manage users -> search, verify, suspend
- [ ] Manage listings -> activate, pause, delete
- [ ] View verifications -> approve/reject with reason
- [ ] View errors -> errors table shows client errors

## J. Edge Cases

- [ ] Slow network (DevTools 3G throttling) -> loading states show, no crash
- [ ] Empty search results -> "No Items Found" empty state
- [ ] Invalid UUID in URL -> error page with retry button
- [ ] 404 page -> shows on unknown routes
- [ ] Refresh mid-flow -> state preserved (sessionStorage)
- [ ] Offline -> offline indicator / PWA fallback

---

## Found Issues

| # | Page | Issue | Status |
|---|------|-------|--------|
|   |      |       |        |
