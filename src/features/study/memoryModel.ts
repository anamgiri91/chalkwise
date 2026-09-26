import type { ReviewConfidence } from '../../types/study.ts';

/**
 * A small memory model in the style of FSRS (Free Spaced Repetition Scheduler).
 *
 * Each notebook has a stability S, measured in days: the time after which the chance of
 * recalling it falls to 90%. Recall probability decays with elapsed time t as
 * R = (1 + F·t/S)^D, and each review updates S from how well the student recalled it.
 * This is a candidate, not the live schedule. `nextReviewAt` in schedule.ts stays the
 * schedule until review_events data shows this model predicts recall better
 * (scripts/fit-schedule.mts).
 *
 * "again" is treated as a failed recall; "good" and "easy" as successful ones. The
 * student's rating is a self-report, so this models reported recall, not mastery.
 */

const DECAY = -0.5;
/** Chosen so that R = 0.9 exactly when t = S. */
const FACTOR = 19 / 81;
const MIN_STABILITY = 0.01;
const MAX_STABILITY = 3650;

/**
 * [0] initial stability after capture (days)
 * [1] lapse multiplier and [2] lapse exponent: S' = w1 · S^w2 after "again"
 * [3] growth scale, [4] growth damping with stability, [5] growth with difficulty,
 *     so S' = S · (1 + e^w3 · S^-w4 · (e^(w5·(1-R)) - 1)) after "good"
 * [6] extra growth multiplier after "easy"
 */
export type MemoryParams = readonly [number, number, number, number, number, number, number];

/** Starting values for fitting; FSRS-like magnitudes, not fitted to Chalkwise data. */
export const DEFAULT_MEMORY_PARAMS: MemoryParams = [1, 0.3, 0.8, 1.2, 0.2, 1.2, 1.5];

export type ReviewStep = { elapsedDays: number; confidence: ReviewConfidence };

const clampStability = (s: number) => Math.min(Math.max(s, MIN_STABILITY), MAX_STABILITY);

export function retrievability(elapsedDays: number, stability: number): number {
  return (1 + (FACTOR * Math.max(elapsedDays, 0)) / stability) ** DECAY;
}

export function nextStability(
  stability: number,
  recall: number,
  confidence: ReviewConfidence,
  p: MemoryParams,
): number {
  if (confidence === 'again') return clampStability(p[1] * stability ** p[2]);
  const growth = Math.exp(p[3]) * stability ** -p[4] * (Math.exp(p[5] * (1 - recall)) - 1);
  const easy = confidence === 'easy' ? p[6] : 1;
  return clampStability(stability * (1 + Math.max(growth, 0) * easy));
}

/**
 * Walk one notebook's reviews in order and return the recall probability the model
 * predicted just before each one. elapsedDays is measured from the previous review,
 * or from capture for the first.
 */
export function predictRecall(history: ReviewStep[], p: MemoryParams): number[] {
  let stability = clampStability(p[0]);
  return history.map((step) => {
    const recall = retrievability(step.elapsedDays, stability);
    stability = nextStability(stability, recall, step.confidence, p);
    return recall;
  });
}

/** Stability after the given reviews, for scheduling the next one. */
export function stabilityAfter(history: ReviewStep[], p: MemoryParams): number {
  let stability = clampStability(p[0]);
  for (const step of history) {
    stability = nextStability(
      stability,
      retrievability(step.elapsedDays, stability),
      step.confidence,
      p,
    );
  }
  return stability;
}

/** Days until recall is predicted to fall to the target, e.g. 0.9. */
export function intervalDays(stability: number, targetRecall: number): number {
  if (!(targetRecall > 0 && targetRecall < 1)) throw new Error('Target recall must be in (0, 1).');
  return (stability / FACTOR) * (targetRecall ** (1 / DECAY) - 1);
}
