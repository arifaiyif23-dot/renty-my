-- Fix track_message_response trigger: the `replies` CTE referenced
-- r.recipient_id which does not exist in the `received` CTE (only id, received_at
-- were selected), so EVERY message INSERT failed with
-- "column r.recipient_id does not exist" and rolled back. A reply to a received
-- message must target the ORIGINAL sender (r.sender_id), not the current user.

CREATE OR REPLACE FUNCTION public.track_message_response()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last_incoming TIMESTAMPTZ;
  v_response_time_minutes DECIMAL(10,2);
  v_total_received INT;
  v_replied_within_24h INT;
BEGIN
  -- 1. Update sender's last_active_at
  UPDATE public.profiles
  SET last_active_at = NOW()
  WHERE id = NEW.sender_id;

  -- 2. Check if this is a reply: look for the most recent message
  --    FROM the recipient TO the sender (i.e., the message being replied to)
  SELECT MAX(created_at) INTO v_last_incoming
  FROM public.messages
  WHERE sender_id = NEW.recipient_id
    AND recipient_id = NEW.sender_id
    AND created_at < NEW.created_at;

  -- 3. If this is a reply, calculate response time
  IF v_last_incoming IS NOT NULL THEN
    v_response_time_minutes := EXTRACT(EPOCH FROM (NEW.created_at - v_last_incoming)) / 60.0;

    -- Update running average response time for the sender
    UPDATE public.profiles
    SET avg_response_time_minutes = (
      SELECT AVG(t.response_time)
      FROM (
        SELECT EXTRACT(EPOCH FROM (m.created_at - prev.created_at)) / 60.0 AS response_time
        FROM public.messages m
        CROSS JOIN LATERAL (
          SELECT MAX(created_at) AS created_at
          FROM public.messages
          WHERE sender_id = m.recipient_id
            AND recipient_id = m.sender_id
            AND created_at < m.created_at
        ) prev
        WHERE m.sender_id = NEW.sender_id
          AND prev.created_at IS NOT NULL
      ) t
    )
    WHERE id = NEW.sender_id;
  END IF;

  -- 4. Calculate response rate for the sender:
  --    Percentage of received messages that got a reply within 24 hours
  WITH received AS (
    SELECT m.id, m.sender_id AS other_id, m.created_at AS received_at
    FROM public.messages m
    WHERE m.recipient_id = NEW.sender_id
  ),
  replies AS (
    SELECT r.id,
      EXISTS (
        SELECT 1 FROM public.messages m2
        WHERE m2.sender_id = NEW.sender_id
          AND m2.recipient_id = r.other_id
          AND m2.created_at > r.received_at
          AND m2.created_at <= r.received_at + INTERVAL '24 hours'
      ) AS replied_in_time
    FROM received r
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE replied_in_time)
  INTO v_total_received, v_replied_within_24h
  FROM replies;

  IF v_total_received > 0 THEN
    UPDATE public.profiles
    SET response_rate = ROUND((v_replied_within_24h::DECIMAL / v_total_received) * 100, 2)
    WHERE id = NEW.sender_id;
  END IF;

  RETURN NULL;
END;
$$;
