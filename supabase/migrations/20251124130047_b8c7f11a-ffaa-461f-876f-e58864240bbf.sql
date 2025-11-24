-- Fix security linter warnings from previous migration

-- Fix 1: Set search_path for all new functions
CREATE OR REPLACE FUNCTION approximate_coordinate(coord numeric)
RETURNS numeric AS $$
BEGIN
  RETURN ROUND(coord::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION mask_account_number(account_number text)
RETURNS text AS $$
BEGIN
  IF account_number IS NULL OR length(account_number) < 4 THEN
    RETURN '****';
  END IF;
  RETURN repeat('*', length(account_number) - 4) || right(account_number, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION hash_ic_number(ic text)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(ic || 'salt-change-this', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION update_approximate_coordinates()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL THEN
    NEW.approximate_latitude := approximate_coordinate(NEW.latitude);
  END IF;
  IF NEW.longitude IS NOT NULL THEN
    NEW.approximate_longitude := approximate_coordinate(NEW.longitude);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;