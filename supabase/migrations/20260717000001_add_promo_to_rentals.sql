ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS original_total_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id);
