-- Each challenge is now a single goal; merge goal fields into challenges.

-- 1. Add goal fields to challenges
ALTER TABLE challenges
  ADD COLUMN target_count integer NOT NULL DEFAULT 1,
  ADD COLUMN goal_window  text    NOT NULL DEFAULT 'daily'
    CHECK (goal_window IN ('daily', 'weekly', 'monthly'));

-- 2. Migrate existing goal data into challenges (first goal per challenge wins)
UPDATE challenges c
SET
  target_count = g.target_count,
  goal_window  = g.goal_window
FROM (
  SELECT DISTINCT ON (challenge_id) challenge_id, target_count, goal_window
  FROM goals
  ORDER BY challenge_id, created_at
) g
WHERE c.id = g.challenge_id;

-- 3. Drop goal-related indexes on check_ins
DROP INDEX IF EXISTS idx_check_ins_goal_id;
DROP INDEX IF EXISTS idx_check_ins_window;

-- 4. Drop FK and goal_id column from check_ins
ALTER TABLE check_ins DROP CONSTRAINT IF EXISTS check_ins_goal_id_fkey;
ALTER TABLE check_ins DROP COLUMN IF EXISTS goal_id;

-- 5. Re-add the window index without goal_id
CREATE INDEX idx_check_ins_challenge_window ON check_ins(challenge_id, window_key);

-- 6. Drop goals RLS policy and table
DROP POLICY IF EXISTS "users_own_goals" ON goals;
DROP INDEX IF EXISTS idx_goals_challenge_id;
DROP TABLE IF EXISTS goals;
