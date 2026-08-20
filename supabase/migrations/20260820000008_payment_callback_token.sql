-- ============================================================================
-- Fasa B (Audit 2026-08-19): per-bill callback secret for payment-callback.
--
-- payment-callback is a public (no JWT) webhook that ToyyibPay POSTs to.
-- Defense-in-depth: create-payment now issues a random per-bill callback token,
-- embeds it in the bill callback URL (?cb_token=...) and stores it on the
-- payment row. payment-callback rejects requests whose token does not match
-- the payment's stored token (constant-time compare). Combined with the
-- existing authoritative ToyyibPay getBillTransactions re-verification, a
-- spoofed callback can no longer even trigger the ToyyibPay lookup.
-- ============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS callback_token text;