-- Enforce valid rental status transitions via trigger
-- Prevents direct API calls from setting any status to any value

CREATE OR REPLACE FUNCTION public.check_rental_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow on insert (no previous status to check)
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Allow if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Valid transitions
  IF NOT (
    (OLD.status = 'pending' AND NEW.status = 'cancelled') OR
    (OLD.status = 'pending_approval' AND NEW.status IN ('approved', 'rejected', 'cancelled')) OR
    (OLD.status = 'approved' AND NEW.status IN ('paid', 'cancelled')) OR
    (OLD.status = 'paid' AND NEW.status IN ('active', 'cancelled')) OR
    (OLD.status = 'active' AND NEW.status IN ('completed', 'disputed')) OR
    (OLD.status = 'disputed' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid rental status transition: % -> %', OLD.status, NEW.status
      USING HINT = 'Valid transitions are: pending→cancelled, pending_approval→approved/rejected/cancelled, approved→paid/cancelled, paid→active/cancelled, active→completed/disputed, disputed→completed/cancelled';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rental_status_transition
  BEFORE UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rental_status_transition();
