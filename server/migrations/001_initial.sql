-- REVIEW BEFORE APPLYING. New PostgreSQL database only; no Supabase objects touched.
-- Run with a migration principal, never the API login. Roles are provisioned separately.
BEGIN;
CREATE SCHEMA chalkwise;
REVOKE ALL ON SCHEMA chalkwise FROM PUBLIC;

CREATE FUNCTION chalkwise.user_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE TABLE chalkwise.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  year text NOT NULL CHECK (year IN ('Freshman','Sophomore','Junior','Senior','Graduate')),
  major text NOT NULL CHECK (length(trim(major)) BETWEEN 1 AND 160)
);
CREATE TABLE chalkwise.courses (
  id text PRIMARY KEY,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 40),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  professor text NOT NULL DEFAULT '' CHECK (length(professor)<=160)
);
CREATE TABLE chalkwise.course_memberships (
  user_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  course_id text NOT NULL REFERENCES chalkwise.courses(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
CREATE TABLE chalkwise.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  addressee_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX friendship_pair ON chalkwise.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
CREATE INDEX friendships_addressee ON chalkwise.friendships(addressee_id, status);
CREATE INDEX friendships_requester ON chalkwise.friendships(requester_id, status);

CREATE TABLE chalkwise.lectures (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  course_id text NOT NULL REFERENCES chalkwise.courses(id),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  summary text NOT NULL,
  key_concepts text[] NOT NULL DEFAULT '{}',
  important_points text[] NOT NULL DEFAULT '{}',
  assignments text[] NOT NULL DEFAULT '{}',
  exam_mentions text[] NOT NULL DEFAULT '{}',
  shared boolean NOT NULL DEFAULT false,
  source_lecture_id text REFERENCES chalkwise.lectures(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_lecture_id)
);
CREATE INDEX lecture_owner_course ON chalkwise.lectures(owner_id, course_id, created_at DESC);
CREATE TABLE chalkwise.materials (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  lecture_id text REFERENCES chalkwise.lectures(id),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_lecture ON chalkwise.materials(lecture_id, created_at);
CREATE TABLE chalkwise.reviews (
  user_id uuid NOT NULL REFERENCES chalkwise.profiles(id),
  lecture_id text NOT NULL REFERENCES chalkwise.lectures(id),
  confidence text NOT NULL CHECK (confidence IN ('again','good','easy')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz NOT NULL,
  PRIMARY KEY(user_id, lecture_id)
);

ALTER TABLE chalkwise.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.course_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.courses FORCE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.course_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.friendships FORCE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.lectures FORCE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.materials FORCE ROW LEVEL SECURITY;
ALTER TABLE chalkwise.reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY profile_read ON chalkwise.profiles FOR SELECT TO chalkwise_app USING (chalkwise.user_id() IS NOT NULL);
CREATE POLICY profile_insert ON chalkwise.profiles FOR INSERT TO chalkwise_app WITH CHECK (id=chalkwise.user_id());
CREATE POLICY profile_update ON chalkwise.profiles FOR UPDATE TO chalkwise_app USING (id=chalkwise.user_id()) WITH CHECK (id=chalkwise.user_id());
CREATE POLICY course_read ON chalkwise.courses FOR SELECT TO chalkwise_app USING (chalkwise.user_id() IS NOT NULL);
CREATE POLICY course_insert ON chalkwise.courses FOR INSERT TO chalkwise_app WITH CHECK (chalkwise.user_id() IS NOT NULL);
CREATE POLICY membership_own ON chalkwise.course_memberships TO chalkwise_app
  USING (user_id=chalkwise.user_id()) WITH CHECK (user_id=chalkwise.user_id());
CREATE POLICY friendship_read ON chalkwise.friendships FOR SELECT TO chalkwise_app
  USING (chalkwise.user_id() IN (requester_id,addressee_id));
CREATE POLICY friendship_insert ON chalkwise.friendships FOR INSERT TO chalkwise_app
  WITH CHECK (requester_id=chalkwise.user_id() AND status='pending');
CREATE POLICY friendship_accept ON chalkwise.friendships FOR UPDATE TO chalkwise_app
  USING (addressee_id=chalkwise.user_id() AND status='pending')
  WITH CHECK (addressee_id=chalkwise.user_id() AND status='accepted');
CREATE POLICY lecture_read ON chalkwise.lectures FOR SELECT TO chalkwise_app USING (
  owner_id=chalkwise.user_id() OR (shared AND
    EXISTS (SELECT 1 FROM chalkwise.course_memberships m WHERE m.course_id=lectures.course_id AND m.user_id=chalkwise.user_id()) AND
    EXISTS (SELECT 1 FROM chalkwise.friendships f WHERE f.status='accepted' AND
      ((f.requester_id=owner_id AND f.addressee_id=chalkwise.user_id()) OR
       (f.addressee_id=owner_id AND f.requester_id=chalkwise.user_id()))))
);
CREATE POLICY lecture_insert ON chalkwise.lectures FOR INSERT TO chalkwise_app
  WITH CHECK (owner_id=chalkwise.user_id() AND NOT shared AND
    EXISTS (SELECT 1 FROM chalkwise.course_memberships m WHERE m.course_id=lectures.course_id AND m.user_id=chalkwise.user_id()));
CREATE POLICY lecture_share ON chalkwise.lectures FOR UPDATE TO chalkwise_app
  USING (owner_id=chalkwise.user_id()) WITH CHECK (owner_id=chalkwise.user_id());
CREATE POLICY material_read ON chalkwise.materials FOR SELECT TO chalkwise_app USING (
  owner_id=chalkwise.user_id() OR (status='ready' AND EXISTS (SELECT 1 FROM chalkwise.lectures l WHERE l.id=materials.lecture_id))
);
CREATE POLICY material_insert ON chalkwise.materials FOR INSERT TO chalkwise_app
  WITH CHECK (owner_id=chalkwise.user_id() AND (lecture_id IS NULL OR EXISTS (
    SELECT 1 FROM chalkwise.lectures l WHERE l.id=materials.lecture_id AND l.owner_id=chalkwise.user_id())));
CREATE POLICY material_update ON chalkwise.materials FOR UPDATE TO chalkwise_app
  USING (owner_id=chalkwise.user_id() AND lecture_id IS NULL)
  WITH CHECK (owner_id=chalkwise.user_id() AND (lecture_id IS NULL OR EXISTS (
    SELECT 1 FROM chalkwise.lectures l WHERE l.id=materials.lecture_id AND l.owner_id=chalkwise.user_id())));
CREATE POLICY review_own ON chalkwise.reviews TO chalkwise_app USING (user_id=chalkwise.user_id())
  WITH CHECK (user_id=chalkwise.user_id() AND EXISTS (
    SELECT 1 FROM chalkwise.lectures l WHERE l.id=reviews.lecture_id AND l.owner_id=chalkwise.user_id()));

GRANT USAGE ON SCHEMA chalkwise TO chalkwise_app;
GRANT EXECUTE ON FUNCTION chalkwise.user_id() TO chalkwise_app;
REVOKE EXECUTE ON FUNCTION chalkwise.user_id() FROM PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA chalkwise TO chalkwise_app;
GRANT INSERT ON chalkwise.profiles, chalkwise.courses, chalkwise.course_memberships,
  chalkwise.friendships, chalkwise.lectures, chalkwise.materials, chalkwise.reviews TO chalkwise_app;
GRANT UPDATE(name,year,major) ON chalkwise.profiles TO chalkwise_app;
GRANT UPDATE(status) ON chalkwise.friendships TO chalkwise_app;
GRANT UPDATE(shared) ON chalkwise.lectures TO chalkwise_app;
GRANT UPDATE(lecture_id,status) ON chalkwise.materials TO chalkwise_app;
GRANT UPDATE(confidence,reviewed_at,next_review_at) ON chalkwise.reviews TO chalkwise_app;
GRANT DELETE ON chalkwise.course_memberships TO chalkwise_app;
COMMIT;
