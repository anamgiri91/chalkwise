-- REVIEW BEFORE APPLYING. Additive: new columns with defaults, two new tables and new
-- grants. Nothing existing is dropped or rewritten. Run after 002 with a migration
-- principal, never the API login, and before deploying an API build that uses them.
BEGIN;

-- Editable notes. Owners could already update their lectures under the lecture_share
-- policy; only the sharing column was granted. These grants let an owner correct the
-- generated notes. note_sources records which original photo each note line came from
-- ({"keyConcepts":[1,null],...}, 1-based photo numbers, null when unknown).
ALTER TABLE chalkwise.lectures
  ADD COLUMN note_sources jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(note_sources) = 'object' AND pg_column_size(note_sources) <= 16384),
  ADD COLUMN edited_at timestamptz;
GRANT UPDATE(title,summary,key_concepts,important_points,assignments,exam_mentions,note_sources,edited_at)
  ON chalkwise.lectures TO chalkwise_app;

-- Weekly class times, per student: two students in one course can be in different
-- sections. Used to suggest the course at capture time and to spot missed classes.
CREATE TABLE chalkwise.course_meetings (
  user_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  course_id text NOT NULL REFERENCES chalkwise.courses(id),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL CHECK (ends_at > starts_at),
  PRIMARY KEY (user_id, course_id, weekday, starts_at)
);
ALTER TABLE chalkwise.course_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.course_meetings FORCE ROW LEVEL SECURITY;
CREATE POLICY meeting_own ON chalkwise.course_meetings TO chalkwise_app
  USING (user_id=chalkwise.user_id())
  WITH CHECK (user_id=chalkwise.user_id() AND EXISTS (
    SELECT 1 FROM chalkwise.course_memberships m
    WHERE m.course_id=course_meetings.course_id AND m.user_id=chalkwise.user_id()));
GRANT SELECT, INSERT, DELETE ON chalkwise.course_meetings TO chalkwise_app;

-- Quiz attempts. Missed questions are kept so a student can retry them without
-- generating a new quiz. Append-only, like review_events.
CREATE TABLE chalkwise.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  lecture_id text NOT NULL REFERENCES chalkwise.lectures(id),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  score smallint NOT NULL CHECK (score >= 0),
  total smallint NOT NULL CHECK (total BETWEEN 1 AND 20 AND score <= total),
  missed jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(missed) = 'array' AND pg_column_size(missed) <= 32768)
);
CREATE INDEX quiz_attempts_history ON chalkwise.quiz_attempts(user_id, lecture_id, attempted_at DESC);
ALTER TABLE chalkwise.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.quiz_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY quiz_attempt_read ON chalkwise.quiz_attempts FOR SELECT TO chalkwise_app
  USING (user_id=chalkwise.user_id());
CREATE POLICY quiz_attempt_insert ON chalkwise.quiz_attempts FOR INSERT TO chalkwise_app
  WITH CHECK (user_id=chalkwise.user_id() AND EXISTS (
    SELECT 1 FROM chalkwise.lectures l WHERE l.id=quiz_attempts.lecture_id AND l.owner_id=chalkwise.user_id()));
GRANT SELECT, INSERT ON chalkwise.quiz_attempts TO chalkwise_app;
COMMIT;
