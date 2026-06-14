-- Persist the user's chosen charity on each challenge.
-- Forfeited funds are held by the platform and donated to this charity
-- in a monthly batch (Option A: platform-donates model — no per-challenge
-- Stripe payout, so no money-transmitter exposure).
--
-- charity_id is a free-text key matching src/lib/charities.ts (CHARITIES[].id).
-- There is no charities table yet; add a FK here once charities are real.
ALTER TABLE challenges ADD COLUMN charity_id TEXT;
