-- REVIEW BEFORE APPLYING. Additive: creates one table and changes no existing object.
-- Run with a migration principal after 001_initial.sql, never with the API login.
-- Apply before deploying an API build that writes review events.
--
-- chalkwise.reviews keeps only the latest review per lecture, so each review overwrites
-- the one before it. This log keeps every review so a schedule can be fitted to and
-- evaluated against how students actually recall. Rows are append-only: no UPDATE or
-- DELETE is granted to the API.
BEGIN;
CREATE TABLE chalkwise.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  lecture_id text NOT NULL REFERENCES chalkwise.lectures(id),
  confidence text NOT NULL CHECK (confidence IN ('again','good','easy')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  -- The review time that was due when this review happened; null on a first review.
  scheduled_for timestamptz,
  next_review_at timestamptz NOT NULL,
  -- Which schedule produced next_review_at, so schedules can be compared later.
  scheduler text NOT NULL DEFAULT 'fixed-v1' CHECK (length(scheduler) BETWEEN 1 AND 40)
);
CREATE INDEX review_events_history ON chalkwise.review_events(user_id, lecture_id, reviewed_at);

ALTER TABLE chalkwise.review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.review_events FORCE ROW LEVEL SECURITY;

CREATE POLICY review_event_read ON chalkwise.review_events FOR SELECT TO chalkwise_app
  USING (user_id=chalkwise.user_id());
CREATE POLICY review_event_insert ON chalkwise.review_events FOR INSERT TO chalkwise_app
  WITH CHECK (user_id=chalkwise.user_id() AND EXISTS (
    SELECT 1 FROM chalkwise.lectures l WHERE l.id=review_events.lecture_id AND l.owner_id=chalkwise.user_id()));

GRANT SELECT, INSERT ON chalkwise.review_events TO chalkwise_app;
COMMIT;
