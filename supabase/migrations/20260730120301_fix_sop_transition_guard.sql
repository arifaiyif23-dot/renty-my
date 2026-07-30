-- Fix: remove requested→rejected from transition guard (dead path — no edge function handles it)
CREATE OR REPLACE FUNCTION public.check_rental_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft' AND NEW.status = 'requested') OR
    (OLD.status = 'requested' AND NEW.status IN ('payment_pending', 'cancelled')) OR
    (OLD.status = 'payment_pending' AND NEW.status IN ('reserved', 'cancelled')) OR
    (OLD.status = 'reserved' AND NEW.status IN ('confirmed', 'cancelled')) OR
    (OLD.status = 'confirmed' AND NEW.status IN ('active', 'cancelled')) OR
    (OLD.status = 'active' AND NEW.status IN ('completed', 'disputed', 'overdue')) OR
    (OLD.status = 'overdue' AND NEW.status IN ('completed', 'disputed')) OR
    (OLD.status = 'disputed' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid rental status transition: % -> %', OLD.status, NEW.status
      USING HINT = 'SOP: draft→requested→payment_pending→reserved→confirmed→active. Valid transitions: draft→requested, requested→payment_pending/cancelled, payment_pending→reserved/cancelled, reserved→confirmed/cancelled, confirmed→active/cancelled, active→completed/disputed/overdue, overdue→completed/disputed, disputed→completed/cancelled';
  END IF;

  RETURN NEW;
END;
$$;
