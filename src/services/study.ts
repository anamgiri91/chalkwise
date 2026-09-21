import { getDataMode } from '@/lib/dataMode';
import { apiRequest } from '@/lib/api';
import { nextReviewAt } from '@/features/study/schedule';
import { buildReviewQueue } from '@/features/study/queue';
import { getMyProfile } from './auth';
import { getMyEnrolledCourses } from './enrollment';
import { getLecture, getLectures } from './lectures';
import type { LectureReview, LectureSharing, ReviewConfidence } from '@/types';

const demoReviews = new Map<string, LectureReview>();
export function getWorkspaceCapabilities() {
  const mode = getDataMode();
  return {
    mode,
    reviews: mode !== 'supabase',
    explicitSharing: mode === 'api',
    liveAI: mode !== 'mock',
  };
}
export async function getReviews(): Promise<LectureReview[]> {
  if (getDataMode() === 'api') return apiRequest('/reviews');
  if (getDataMode() === 'mock') return [...demoReviews.values()].map((review) => ({ ...review }));
  return [];
}
export async function recordReview(
  lectureId: string,
  confidence: ReviewConfidence,
): Promise<LectureReview> {
  if (getDataMode() === 'api')
    return apiRequest(`/lectures/${encodeURIComponent(lectureId)}/review`, {
      method: 'PUT',
      body: { confidence },
    });
  if (getDataMode() !== 'mock')
    throw new Error('Review scheduling is available on the new Chalkwise backend.');
  if (!(await getLecture(lectureId))) throw new Error('Notebook not found.');
  const now = new Date();
  const review = {
    lectureId,
    confidence,
    reviewedAt: now.toISOString(),
    nextReviewAt: nextReviewAt(confidence, now),
  };
  demoReviews.set(lectureId, review);
  return { ...review };
}
export async function getLectureSharing(lectureId: string): Promise<LectureSharing | null> {
  if (getDataMode() === 'api')
    return apiRequest(`/lectures/${encodeURIComponent(lectureId)}/sharing`);
  return null;
}
export async function setLectureSharing(
  lectureId: string,
  shared: boolean,
): Promise<LectureSharing> {
  if (getDataMode() !== 'api')
    throw new Error('Explicit notebook sharing requires the new Chalkwise backend.');
  return apiRequest(`/lectures/${encodeURIComponent(lectureId)}/sharing`, {
    method: 'PUT',
    body: { shared },
  });
}
export async function getStudyDashboard() {
  const [profile, courses, reviews] = await Promise.all([
    getMyProfile(),
    getMyEnrolledCourses(),
    getReviews(),
  ]);
  const results = await Promise.allSettled(courses.map((course) => getLectures(course.id)));
  const lectures = results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    profile,
    courses,
    lectures,
    reviews,
    queue: buildReviewQueue(lectures, reviews),
    partial: results.some((result) => result.status === 'rejected'),
  };
}
