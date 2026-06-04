-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  full_name           TEXT,
  stripe_customer_id  TEXT,
  push_token          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Challenges
CREATE TABLE challenges (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  stake_amount                INTEGER NOT NULL,
  platform_fee                INTEGER NOT NULL DEFAULT 300,
  duration_days               INTEGER NOT NULL,
  start_date                  DATE NOT NULL,
  end_date                    DATE NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'completed', 'cancelled')),
  stripe_payment_intent_id    TEXT,
  stripe_refund_id            TEXT,
  protected_amount_cents      INTEGER,
  forfeited_amount_cents      INTEGER,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Goals
CREATE TABLE goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  target_count  INTEGER NOT NULL,
  goal_window   TEXT NOT NULL CHECK (goal_window IN ('daily', 'weekly', 'monthly')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check-ins
CREATE TABLE check_ins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  challenge_id  UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_key    TEXT NOT NULL
);

-- Payments (audit log)
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('deposit', 'refund', 'fee')),
  amount_cents  INTEGER NOT NULL,
  stripe_id     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_challenges_user_id ON challenges(user_id);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_goals_challenge_id ON goals(challenge_id);
CREATE INDEX idx_check_ins_goal_id ON check_ins(goal_id);
CREATE INDEX idx_check_ins_challenge_id ON check_ins(challenge_id);
CREATE INDEX idx_check_ins_window ON check_ins(goal_id, window_key);
CREATE INDEX idx_payments_challenge_id ON payments(challenge_id);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own
CREATE POLICY "users_own_profiles" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Challenges: users see only their own
CREATE POLICY "users_own_challenges" ON challenges
  FOR ALL USING (auth.uid() = user_id);

-- Goals: via challenge ownership
CREATE POLICY "users_own_goals" ON goals
  FOR ALL USING (
    challenge_id IN (SELECT id FROM challenges WHERE user_id = auth.uid())
  );

-- Check-ins: user_id must match
CREATE POLICY "users_own_check_ins" ON check_ins
  FOR ALL USING (auth.uid() = user_id);

-- Payments: user_id must match
CREATE POLICY "users_own_payments" ON payments
  FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
