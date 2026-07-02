-- Allow challenges to be quit early (with 20% penalty on protected funds)
ALTER TABLE challenges
  DROP CONSTRAINT challenges_status_check,
  ADD CONSTRAINT challenges_status_check
    CHECK (status IN ('active', 'completed', 'cancelled', 'quit'));

ALTER TABLE challenges
  ADD COLUMN quit_penalty_cents INTEGER;
