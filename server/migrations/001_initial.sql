-- REVIEW BEFORE APPLYING. New PostgreSQL database only; no Supabase objects touched.
-- Run with a migration principal, never the API login. Roles are provisioned separately.
BEGIN;
CREATE SCHEMA classlens;
REVOKE ALL ON SCHEMA classlens FROM PUBLIC;

CREATE FUNCTION classlens.user_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE TABLE classlens.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  year text NOT NULL CHECK (year IN ('Freshman','Sophomore','Junior','Senior','Graduate')),
  major text NOT NULL CHECK (length(trim(major)) BETWEEN 1 AND 160)
);
CREATE TABLE classlens.courses (
  id text PRIMARY KEY,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 40),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  professor text NOT NULL DEFAULT '' CHECK (length(professor)<=160)
);
CREATE TABLE classlens.course_memberships (
  user_id uuid NOT NULL REFERENCES classlens.profiles(id),
  course_id text NOT NULL REFERENCES classlens.courses(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
CREATE TABLE classlens.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES classlens.profiles(id),
  addressee_id uuid NOT NULL REFERENCES classlens.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX friendship_pair ON classlens.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
CREATE INDEX friendships_addressee ON classlens.friendships(addressee_id, status);
CREATE INDEX friendships_requester ON classlens.friendships(requester_id, status);

CREATE TABLE classlens.lectures (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES classlens.profiles(id),
  course_id text NOT NULL REFERENCES classlens.courses(id),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  summary text NOT NULL,
  key_concepts text[] NOT NULL DEFAULT '{}',
  important_points text[] NOT NULL DEFAULT '{}',
  assignments text[] NOT NULL DEFAULT '{}',
  exam_mentions text[] NOT NULL DEFAULT '{}',
  shared boolean NOT NULL DEFAULT false,
  source_lecture_id text REFERENCES classlens.lectures(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, source_lecture_id)
);
CREATE INDEX lecture_owner_course ON classlens.lectures(owner_id, course_id, created_at DESC);
CREATE TABLE classlens.materials (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES classlens.profiles(id),
  lecture_id text REFERENCES classlens.lectures(id),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_lecture ON classlens.materials(lecture_id, created_at);
CREATE TABLE classlens.reviews (
  user_id uuid NOT NULL REFERENCES classlens.profiles(id),
  lecture_id text NOT NULL REFERENCES classlens.lectures(id),
  confidence text NOT NULL CHECK (confidence IN ('again','good','easy')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz NOT NULL,
  PRIMARY KEY(user_id, lecture_id)
);

ALTER TABLE classlens.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classlens.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE classlens.course_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE classlens.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE classlens.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE classlens.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE classlens.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE classlens.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE classlens.courses FORCE ROW LEVEL SECURITY;
ALTER TABLE classlens.course_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE classlens.friendships FORCE ROW LEVEL SECURITY;
ALTER TABLE classlens.lectures FORCE ROW LEVEL SECURITY;
ALTER TABLE classlens.materials FORCE ROW LEVEL SECURITY;
ALTER TABLE classlens.reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY profile_read ON classlens.profiles FOR SELECT TO classlens_app USING (classlens.user_id() IS NOT NULL);
CREATE POLICY profile_insert ON classlens.profiles FOR INSERT TO classlens_app WITH CHECK (id=classlens.user_id());
CREATE POLICY profile_update ON classlens.profiles FOR UPDATE TO classlens_app USING (id=classlens.user_id()) WITH CHECK (id=classlens.user_id());
CREATE POLICY course_read ON classlens.courses FOR SELECT TO classlens_app USING (classlens.user_id() IS NOT NULL);
CREATE POLICY course_insert ON classlens.courses FOR INSERT TO classlens_app WITH CHECK (classlens.user_id() IS NOT NULL);
CREATE POLICY membership_own ON classlens.course_memberships TO classlens_app
  USING (user_id=classlens.user_id()) WITH CHECK (user_id=classlens.user_id());
CREATE POLICY friendship_read ON classlens.friendships FOR SELECT TO classlens_app
  USING (classlens.user_id() IN (requester_id,addressee_id));
CREATE POLICY friendship_insert ON classlens.friendships FOR INSERT TO classlens_app
  WITH CHECK (requester_id=classlens.user_id() AND status='pending');
CREATE POLICY friendship_accept ON classlens.friendships FOR UPDATE TO classlens_app
  USING (addressee_id=classlens.user_id() AND status='pending')
  WITH CHECK (addressee_id=classlens.user_id() AND status='accepted');
CREATE POLICY lecture_read ON classlens.lectures FOR SELECT TO classlens_app USING (
  owner_id=classlens.user_id() OR (shared AND
    EXISTS (SELECT 1 FROM classlens.course_memberships m WHERE m.course_id=lectures.course_id AND m.user_id=classlens.user_id()) AND
    EXISTS (SELECT 1 FROM classlens.friendships f WHERE f.status='accepted' AND
      ((f.requester_id=owner_id AND f.addressee_id=classlens.user_id()) OR
       (f.addressee_id=owner_id AND f.requester_id=classlens.user_id()))))
);
CREATE POLICY lecture_insert ON classlens.lectures FOR INSERT TO classlens_app
  WITH CHECK (owner_id=classlens.user_id() AND NOT shared AND
    EXISTS (SELECT 1 FROM classlens.course_memberships m WHERE m.course_id=lectures.course_id AND m.user_id=classlens.user_id()));
CREATE POLICY lecture_share ON classlens.lectures FOR UPDATE TO classlens_app
  USING (owner_id=classlens.user_id()) WITH CHECK (owner_id=classlens.user_id());
CREATE POLICY material_read ON classlens.materials FOR SELECT TO classlens_app USING (
  owner_id=classlens.user_id() OR (status='ready' AND EXISTS (SELECT 1 FROM classlens.lectures l WHERE l.id=materials.lecture_id))
);
CREATE POLICY material_insert ON classlens.materials FOR INSERT TO classlens_app
  WITH CHECK (owner_id=classlens.user_id() AND (lecture_id IS NULL OR EXISTS (
    SELECT 1 FROM classlens.lectures l WHERE l.id=materials.lecture_id AND l.owner_id=classlens.user_id())));
CREATE POLICY material_update ON classlens.materials FOR UPDATE TO classlens_app
  USING (owner_id=classlens.user_id() AND lecture_id IS NULL)
  WITH CHECK (owner_id=classlens.user_id() AND (lecture_id IS NULL OR EXISTS (
    SELECT 1 FROM classlens.lectures l WHERE l.id=materials.lecture_id AND l.owner_id=classlens.user_id())));
CREATE POLICY review_own ON classlens.reviews TO classlens_app USING (user_id=classlens.user_id())
  WITH CHECK (user_id=classlens.user_id() AND EXISTS (
    SELECT 1 FROM classlens.lectures l WHERE l.id=reviews.lecture_id AND l.owner_id=classlens.user_id()));

GRANT USAGE ON SCHEMA classlens TO classlens_app;
GRANT EXECUTE ON FUNCTION classlens.user_id() TO classlens_app;
REVOKE EXECUTE ON FUNCTION classlens.user_id() FROM PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA classlens TO classlens_app;
GRANT INSERT ON classlens.profiles, classlens.courses, classlens.course_memberships,
  classlens.friendships, classlens.lectures, classlens.materials, classlens.reviews TO classlens_app;
GRANT UPDATE(name,year,major) ON classlens.profiles TO classlens_app;
GRANT UPDATE(status) ON classlens.friendships TO classlens_app;
GRANT UPDATE(shared) ON classlens.lectures TO classlens_app;
GRANT UPDATE(lecture_id,status) ON classlens.materials TO classlens_app;
GRANT UPDATE(confidence,reviewed_at,next_review_at) ON classlens.reviews TO classlens_app;
GRANT DELETE ON classlens.course_memberships TO classlens_app;
COMMIT;
