-- The FOR ALL policies from 001 let an authenticated user write money rows
-- directly via PostgREST: forge a challenges row without paying, rewrite
-- start/end dates or stake before settling, or rewrite check_ins.window_key
-- after the BEFORE INSERT trigger stamped it (backdating around 007). Clients
-- only ever need to read these tables — Edge Functions write with the service
-- role, which bypasses RLS — with two exceptions: check_ins INSERT (the
-- check-in flow; validated and stamped by the trigger, and with no UPDATE or
-- DELETE policy window_key is immutable once logged) and the user's own
-- profiles row (push_token, stripe_customer_id).
-- auth.uid() is wrapped in a scalar subquery so Postgres caches it per
-- statement instead of re-evaluating per row.

DROP POLICY "users_own_challenges" ON challenges;
CREATE POLICY "users_own_challenges" ON challenges
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY "users_own_check_ins" ON check_ins;
CREATE POLICY "users_read_own_check_ins" ON check_ins
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_insert_own_check_ins" ON check_ins
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY "users_own_payments" ON payments;
CREATE POLICY "users_own_payments" ON payments
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY "users_own_profiles" ON profiles;
CREATE POLICY "users_read_own_profiles" ON profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "users_update_own_profiles" ON profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Pin the trigger function's search_path; with '' every reference must be
-- schema-qualified, so nothing shadows challenges. Body otherwise identical
-- to 007.
CREATE OR REPLACE FUNCTION stamp_check_in()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  c public.challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = NEW.challenge_id;

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

-- Trigger functions are never called through the REST RPC surface, and
-- handle_new_user is SECURITY DEFINER — triggers still fire after this
-- (EXECUTE is only checked at trigger creation time).
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION stamp_check_in() FROM PUBLIC, anon, authenticated;

-- Covering indexes for the user_id FKs — these also serve every policy above.
CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
