-- Pilot metrics. READ-ONLY, aggregate counts only: no names, emails, note text or
-- per-student rows. Run by an operator principal that can read across students
-- (the API login cannot, by design), inside a read-only transaction:
--
--   psql "$OPERATOR_DATABASE_URL" -v ON_ERROR_STOP=1 -f server/infra/pilot-metrics.sql
--
-- Requires migrations 001 and 002. With 10-20 students small counts can identify a
-- person, so buckets with fewer than 3 students are suppressed.
BEGIN READ ONLY;

-- A student is active in a week if they saved a notebook or logged a review.
\echo '== Weekly active students and notebooks saved'
WITH activity AS (
  SELECT owner_id AS user_id, date_trunc('week', created_at) AS week FROM chalkwise.lectures
  UNION
  SELECT user_id, date_trunc('week', reviewed_at) FROM chalkwise.review_events
)
SELECT a.week::date AS week,
       count(DISTINCT a.user_id) AS active_students,
       (SELECT count(*) FROM chalkwise.lectures l
         WHERE date_trunc('week', l.created_at) = a.week AND l.source_lecture_id IS NULL) AS notebooks_captured,
       (SELECT count(*) FROM chalkwise.lectures l
         WHERE date_trunc('week', l.created_at) = a.week AND l.source_lecture_id IS NOT NULL) AS notebooks_copied
FROM activity a
GROUP BY a.week
HAVING count(DISTINCT a.user_id) >= 3
ORDER BY a.week;

\echo '== Retention: share of each starting cohort active N weeks later'
WITH activity AS (
  SELECT owner_id AS user_id, date_trunc('week', created_at) AS week FROM chalkwise.lectures
  UNION
  SELECT user_id, date_trunc('week', reviewed_at) FROM chalkwise.review_events
), first_week AS (
  SELECT user_id, min(week) AS cohort FROM activity GROUP BY user_id
), offsets AS (
  SELECT f.cohort, (extract(epoch FROM a.week - f.cohort) / 604800)::int AS week_offset, a.user_id
  FROM first_week f JOIN activity a USING (user_id)
), sizes AS (
  SELECT cohort, count(*) AS students FROM first_week GROUP BY cohort
)
SELECT o.cohort::date AS cohort, s.students, o.week_offset,
       round(count(DISTINCT o.user_id)::numeric / s.students, 2) AS retained
FROM offsets o JOIN sizes s USING (cohort)
WHERE s.students >= 3
GROUP BY o.cohort, s.students, o.week_offset
ORDER BY o.cohort, o.week_offset;

\echo '== Photos per captured notebook'
SELECT photos, count(*) AS notebooks
FROM (
  SELECT l.id, count(m.id) AS photos
  FROM chalkwise.lectures l
  LEFT JOIN chalkwise.materials m ON m.lecture_id = l.id AND m.status = 'ready'
  WHERE l.source_lecture_id IS NULL
  GROUP BY l.id
) per_notebook
GROUP BY photos ORDER BY photos;

\echo '== Reviews: volume, recall and whether students come back when a review is due'
SELECT count(*) AS reviews,
       count(DISTINCT user_id) AS reviewing_students,
       round(avg((confidence = 'again')::int), 2) AS share_again,
       round(avg((scheduled_for IS NULL)::int), 2) AS share_first_reviews,
       -- On time: within a day of when the review was due.
       round(avg((reviewed_at <= scheduled_for + interval '1 day')::int)
             FILTER (WHERE scheduled_for IS NOT NULL), 2) AS share_on_time,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM reviewed_at - scheduled_for) / 3600)
         FILTER (WHERE scheduled_for IS NOT NULL) AS median_hours_late
FROM chalkwise.review_events
HAVING count(DISTINCT user_id) >= 3;

\echo '== Recall by review number (what a fitted schedule will learn from)'
SELECT review_number, count(*) AS reviews,
       round(avg((confidence = 'again')::int), 2) AS share_again,
       round(avg((confidence = 'easy')::int), 2) AS share_easy
FROM (
  SELECT user_id, confidence,
         row_number() OVER (PARTITION BY user_id, lecture_id ORDER BY reviewed_at) AS review_number
  FROM chalkwise.review_events
) numbered
GROUP BY review_number
HAVING count(DISTINCT user_id) >= 3
ORDER BY review_number;

\echo '== Sharing'
SELECT count(*) FILTER (WHERE shared) AS notebooks_shared,
       count(*) FILTER (WHERE source_lecture_id IS NOT NULL) AS copies_saved
FROM chalkwise.lectures;

ROLLBACK;
