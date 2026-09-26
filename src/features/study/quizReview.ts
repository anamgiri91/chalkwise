import type { ReviewConfidence } from '../../types/study.ts';

/**
 * How a finished quiz counts as a review. A quiz is recall practice, so its score is
 * a better signal than a self-rating: all correct schedules the notebook further out,
 * most correct keeps the normal interval, and a weak score brings it back soon.
 * Only a full first pass counts; retrying missed questions is practice, not a review.
 */
export function confidenceFromQuiz(score: number, total: number): ReviewConfidence {
  if (!(total > 0) || score < 0 || score > total) throw new Error('Invalid quiz score.');
  const ratio = score / total;
  if (ratio === 1) return 'easy';
  if (ratio >= 0.6) return 'good';
  return 'again';
}

export function describeQuizReview(confidence: ReviewConfidence): string {
  return {
    easy: 'All correct, so this notebook comes back in 3 days.',
    good: 'Mostly correct, so this notebook comes back tomorrow.',
    again: 'A few to work on, so this notebook comes back in 4 hours.',
  }[confidence];
}
