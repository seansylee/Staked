-- One challenge per Stripe payment — prevents replaying a payment_intent_id
-- through confirm-challenge-start to mint multiple challenges off one charge.
ALTER TABLE challenges
  ADD CONSTRAINT challenges_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);
