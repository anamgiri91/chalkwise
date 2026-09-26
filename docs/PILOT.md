# Pilot plan (10–20 students)

The pilot turns Chalkwise from a working app into evidence: real students, real
boards, measured outcomes. It also produces the two datasets the ML work needs, real
labelled claims for the grounding check and review histories for a fitted schedule.

Provisioning is covered in the [AWS deployment runbook](architecture/AWS_DEPLOYMENT.md)
and its launch gates in [deployment readiness](DEPLOYMENT_READINESS.md). Nothing in
this plan provisions or changes cloud resources.

## Questions the pilot answers

Write the thresholds down before inviting anyone, so the results cannot move them.

| Question | Measured by | Proposed signal |
| --- | --- | --- |
| Do students keep capturing? | Weekly active students, notebooks per week | ≥ 60% of students active in week 4 |
| Do they come back to review? | Share of due reviews done within a day | ≥ 50% on time |
| Is capture reliable? | Upload-to-notebook success, photos per notebook, unreadable photos | ≥ 95% of sessions produce a notebook |
| Does the grounding check protect them? | Removed-claim counts; labelled pilot claims | No invented deadline reaches a student unflagged in the labelled sample |
| Is it affordable? | Provider and AWS cost per successful notebook | Recorded, not guessed |

## Before inviting students

1. Complete the AWS runbook's acceptance and "operations before invitation" steps.
2. Apply `server/migrations/001_initial.sql`, `002_review_events.sql` and `003_study_features.sql` in order (after
   review and approval). The review log only records reviews made after 002 is applied.
3. Decide which grounding check ships. `isSupported` is live today;
   `isSupportedByClause` measured better (see the
   [grounding evaluation](evaluation/GROUNDING_EVAL.md)) but is not wired in.
4. Write a one-page participant notice in plain language covering: what is stored
   (photos, generated notes, review ratings), who can see it (only the student, plus
   friends they share with), that only aggregate counts are reported, the known gaps
   (no self-service export or deletion yet, so give an email contact that handles it),
   and a separate opt-in for using a student's transcripts in the evaluation set.
5. Confirm pilot eligibility (institution domain or invite list) rejects an outside
   email through the Cognito API, not only the form.

## Every week

- Run `server/infra/pilot-metrics.sql` with the operator principal. It is read-only,
  reports aggregates only, and suppresses groups smaller than three students.
- Check the API logs for `Analysis dropped unsupported claims` (counts only) and
  failed analyses.
- Collect one or two lines of feedback per student: what they used, what broke, what
  they wished it did.
- Keep a short log of incidents and fixes; it becomes the post-pilot write-up.

## Labelled claims from real captures

The current grounding set was written for evaluation, not collected. With opt-in
consent:

1. Sample about 30 analyses across courses and students.
2. For each generated assignment and exam mention, label it supported or unsupported
   against the transcript, using the categories in `tests/fixtures/grounding-eval.jsonl`.
3. Remove names, emails and anything identifying, then add them as a `pilot` split.
   Report it separately and never tune on it.

This is the number that matters most: how each verifier performs on claims a model
actually produced from real boards.

## After four or more weeks

- Export `review_events` without user IDs (replace them with per-export random IDs)
  and fit the review schedule against it (roadmap: FSRS versus the fixed 4 h / 1 d / 3 d
  intervals, compared by predictive log-loss on held-out reviews).
- Write up the results: what was measured, what failed, what changed. For a resume,
  one line with real numbers, for example: "Piloted with N students for W weeks; X%
  weekly retention; the grounding check removed Y invented items from Z notebooks."
  Fill it in only with measured values.
