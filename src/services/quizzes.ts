import { getDataMode } from '@/lib/dataMode';
import { apiRequest } from '@/lib/api';
import type { QuizAttempt, QuizQuestion } from '@/types';

const demoAttempts = new Map<string, QuizAttempt[]>();

export function quizHistoryAvailable(): boolean {
  return getDataMode() !== 'supabase';
}

/** This notebook's recent quiz attempts, newest first. */
export async function getQuizAttempts(lectureId: string): Promise<QuizAttempt[]> {
  if (getDataMode() === 'api')
    return apiRequest(`/lectures/${encodeURIComponent(lectureId)}/quiz-attempts`);
  if (getDataMode() === 'mock') return [...(demoAttempts.get(lectureId) ?? [])];
  return [];
}

export async function recordQuizAttempt(
  lectureId: string,
  attempt: { score: number; total: number; missed: QuizQuestion[] },
): Promise<QuizAttempt> {
  if (getDataMode() === 'api')
    return apiRequest(`/lectures/${encodeURIComponent(lectureId)}/quiz-attempts`, {
      method: 'POST',
      body: attempt,
    });
  if (getDataMode() !== 'mock')
    throw new Error('Quiz history is available on the new Chalkwise backend.');
  const saved: QuizAttempt = {
    id: `demo-attempt-${Date.now()}`,
    lectureId,
    attemptedAt: new Date().toISOString(),
    ...attempt,
  };
  demoAttempts.set(lectureId, [saved, ...(demoAttempts.get(lectureId) ?? [])].slice(0, 20));
  return saved;
}
