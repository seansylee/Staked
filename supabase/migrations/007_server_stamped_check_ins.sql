-- Check-ins trusted the client-supplied window_key and logged_at, so past
-- windows could be backfilled (and future ones pre-filled) via direct API
-- calls. Stamp both server-side at insert time and reject check-ins for
-- challenges the user doesn't own, that aren't active, or that aren't in
-- progress. Formats must match getWindowKey in src/utils/dates.ts and
-- supabase/functions/_shared/protection.ts: daily "YYYY-MM-DD", weekly
-- ISO "IYYY-Wnn", monthly "YYYY-MM" — all at UTC.

CREATE OR REPLACE FUNCTION stamp_check_in()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  c challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM challenges WHERE id = NEW.challenge_id;

  IF c.id IS NULL THEN
    RAISE EXCEPTION 'challenge not found';
  END IF;
  IF c.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'check-in user does not own challenge';
  END IF;
  IF c.status <> 'active' THEN
    RAISE EXCEPTION 'challenge is not active';
  END IF;
  IF now() < (c.start_date::timestamp AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'challenge has not started';
  END IF;
  IF now() >= ((c.end_date + 1)::timestamp AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'challenge has ended';
  END IF;

  NEW.logged_at := now();
  NEW.window_key := CASE c.goal_window
    WHEN 'daily'   THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    WHEN 'weekly'  THEN to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW')
    WHEN 'monthly' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_check_in_before_insert ON check_ins;
CREATE TRIGGER stamp_check_in_before_insert
  BEFORE INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION stamp_check_in();
