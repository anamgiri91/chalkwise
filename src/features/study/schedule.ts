import type { ReviewConfidence } from '../../types/study.ts';
export type { ReviewConfidence } from '../../types/study.ts';

/** A transparent first review schedule, not a prediction of mastery. */
export function nextReviewAt(confidence: ReviewConfidence, now: Date = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error('A valid review time is required.');
  const hours = { again: 4, good: 24, easy: 72 }[confidence];
  if (!hours) throw new Error('Choose how well you recalled the lecture.');
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}
