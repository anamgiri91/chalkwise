-- Export the review log for scripts/fit-schedule.mts. READ-ONLY. Run by an operator
-- principal, with written consent covering this use:
--
--   psql "$OPERATOR_DATABASE_URL" -v ON_ERROR_STOP=1 -f server/infra/export-review-events.sql
--
-- Student and notebook IDs are replaced with salted hashes. The salt is random per
-- export and never written out, so exports cannot be joined to each other or back to
-- accounts. Only timing and the self-reported rating leave the database: no names,
-- emails, titles or note text. Treat the file as study data and delete it after use.
BEGIN READ ONLY;
-- \gset stores the result in a psql variable instead of printing the salt.
SELECT set_config('export.salt', gen_random_uuid()::text, true) AS salt \gset
\copy (SELECT left(md5(current_setting('export.salt') || e.user_id::text), 12) AS student, left(md5(current_setting('export.salt') || e.lecture_id), 12) AS notebook, to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS captured_at, to_char(e.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS reviewed_at, e.confidence FROM chalkwise.review_events e JOIN chalkwise.lectures l ON l.id = e.lecture_id ORDER BY e.reviewed_at) TO 'review-events.csv' WITH (FORMAT csv, HEADER)
ROLLBACK;
