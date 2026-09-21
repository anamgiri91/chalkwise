export type ReviewConfidence = 'again' | 'good' | 'easy';
export type LectureReview = {
  lectureId: string;
  confidence: ReviewConfidence;
  reviewedAt: string;
  nextReviewAt: string;
};
export type LectureSharing = { shared: boolean; canEdit: boolean };
