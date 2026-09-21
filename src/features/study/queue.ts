import type { Lecture } from '../lectures/types.ts';
import type { LectureReview } from '../../types/study.ts';

export function buildReviewQueue(lectures: Lecture[], reviews: LectureReview[], now = new Date()) {
  const byLecture = new Map(reviews.map((review) => [review.lectureId, review]));
  return lectures
    .flatMap((lecture) => {
      const review = byLecture.get(lecture.id);
      if (review && new Date(review.nextReviewAt).getTime() > now.getTime()) return [];
      return [
        {
          lecture,
          reason: review ? 'Ready to revisit' : 'Not reviewed yet',
          dueAt: review?.nextReviewAt ?? lecture.createdAt,
        },
      ];
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.lecture.id.localeCompare(b.lecture.id));
}
