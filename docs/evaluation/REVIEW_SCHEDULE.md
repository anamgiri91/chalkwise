# Review schedule model

Chalkwise schedules the next review on fixed intervals: 4 hours after "again", 1 day
after "good" and 3 days after "easy" (`src/features/study/schedule.ts`). Fixed intervals
ignore how many times a notebook has been reviewed, how late the review was, and how
fast a given notebook is forgotten. This page describes the model that could replace
them and how it will be judged. **It is not live.** The fixed schedule stays until real
review data shows the model predicts recall better.

```sh
node scripts/fit-schedule.mts --synthetic          # validate on simulated students
node scripts/fit-schedule.mts review-events.csv    # real, pseudonymized export
```

## Model

`src/features/study/memoryModel.ts`, in the style of
[FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)
(Free Spaced Repetition Scheduler):

- Each notebook has a **stability** S, measured in days: the time after which predicted
  recall falls to 90%. Recall decays as R = (1 + (19/81)·t/S)^-0.5.
- "Again" shrinks stability (S' = w1·S^w2). "Good" grows it, more when stability is low
  and when the recall was hard (low R). "Easy" multiplies that growth.
- The next review is due when predicted recall reaches a target, e.g. 90%:
  t = (S / (19/81)) · (0.9^-2 − 1).

It has seven parameters, fitted by minimizing log-loss with Nelder–Mead. The outcome
is *reported* recall ("again" = miss). The rating is a student's self-report, not a
measure of mastery.

## Data

Every review is now logged in `chalkwise.review_events` (migration 002).
`server/infra/export-review-events.sql` exports it for fitting. Student and notebook
IDs are salted hashes with a random per-export salt, and only timing and the rating
leave the database.

Students are split 80/20 by hashed ID, so the test score measures how well a model
fitted on some students predicts **other** students.

## Validation on simulated students

There is no real review data yet. To check that the fitting pipeline works, the script
simulates 80 students × 6 notebooks × 6 reviews on the live fixed schedule, with
random lateness. Recall follows known "true" parameters, scaled by a per-student
ability the model cannot represent, so the fit is tested under mild misspecification.

| Predictor (held-out students) | Log-loss | Brier |
| --- | --- | --- |
| Constant (training recall rate) | 0.3702 | 0.1068 |
| Logistic regression (log elapsed time, review number) | 0.3618 | 0.1048 |
| Memory model, unfitted defaults | 0.3385 | 0.0984 |
| **Memory model, fitted** | **0.3297** | **0.0961** |
| Memory model, true parameters (reference) | 0.3282 | 0.0957 |

The fitted model comes within 0.0015 log-loss of the parameters that generated the
data. **This validates the code, not the model.** A simulator that follows the model's
own assumptions will always favour it. The "easy" multiplier landed on its lower bound
because simulated students rarely rate "easy", so it is poorly identified at this data
size.

## When to switch

Run the comparison on the real export once the pilot has a few weeks of reviews (see
the [pilot plan](../PILOT.md)). Switch only if the fitted model beats the constant and
logistic baselines on held-out students by more than run-to-run noise. Record the
`scheduler` column (`fixed-v1` today) so outcomes under the two schedules can be
compared afterwards. Until then, the fixed intervals remain: they are transparent and
easy for a student to understand.
