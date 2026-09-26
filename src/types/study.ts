import type { QuizQuestion } from './quiz.ts';
export type ReviewConfidence = 'again' | 'good' | 'easy';
export type LectureReview = {
  lectureId: string;
  confidence: ReviewConfidence;
  reviewedAt: string;
  nextReviewAt: string;
};
export type LectureSharing = { shared: boolean; canEdit: boolean };

/** A weekly class time. weekday follows Date.getDay(): 0 is Sunday. Times are local "HH:MM". */
export type CourseMeeting = { courseId: string; weekday: number; start: string; end: string };

export type QuizAttempt = {
  id: string;
  lectureId: string;
  attemptedAt: string;
  score: number;
  total: number;
  /** Questions answered wrong, kept so they can be retried without a new quiz. */
  missed: QuizQuestion[];
};
