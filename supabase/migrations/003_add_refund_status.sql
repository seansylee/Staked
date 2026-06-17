ALTER TABLE challenges
  ADD COLUMN refund_status TEXT DEFAULT 'pending'
    CHECK (refund_status IN ('pending', 'succeeded', 'failed'));
