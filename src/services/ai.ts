import { parseQuizInput, parseQuizResult } from '@/lib/quiz';
import { parseAskLectureInput, parseAskLectureResult } from '@/lib/askLecture';
import type { LectureAnalysis, Material, GenerateQuizResult, AskLectureResult } from '@/types';

import { getDataMode } from '@/lib/dataMode';
import { apiRequest } from '@/lib/api';
import { parseLectureAnalysis } from '@/lib/lectureAnalysis';

/** Matches the server's per-session ceiling and the capture screen's limit. */
export const MAX_ANALYZED_PHOTOS = 6;

/**
 * Analyze one capture session. Photos are sent together so the organized notes cover
 * the whole board sequence rather than only its first page.
 */
export async function analyzeMaterials(materials: Material[]): Promise<LectureAnalysis> {
  if (!materials.length) throw new Error('Capture at least one photo to analyze.');
  if (materials.length > MAX_ANALYZED_PHOTOS) {
    throw new Error(`Analyze up to ${MAX_ANALYZED_PHOTOS} photos at a time.`);
  }
  if (materials.some((material) => material.type !== 'photo')) {
    throw new Error('Only photos can be analyzed.');
  }
  if (getDataMode() === 'api')
    return parseLectureAnalysis(
      await apiRequest('/ai/analyze', {
        method: 'POST',
        body: { materialIds: materials.map((material) => material.id) },
      }),
    );
  if (getDataMode() !== 'supabase')
    throw new Error('Analysis requires EXPO_PUBLIC_DATA_MODE=api or supabase.');
  if (materials.length > 1) {
    throw new Error(
      'The legacy backend analyzes one photo at a time. Use EXPO_PUBLIC_DATA_MODE=api for a full session.',
    );
  }
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.functions.invoke('analyze-material', {
    body: { materialId: materials[0].id },
  });
  if (error) {
    let message = 'Photo analysis failed. Check your connection and function deployment.';
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        if (typeof body?.error?.message === 'string') message = body.error.message;
      } catch {
        /* Keep a useful message for non-JSON gateway errors. */
      }
    }
    throw new Error(message);
  }
  return parseLectureAnalysis(data);
}

export async function analyzeMaterial(material: Material): Promise<LectureAnalysis> {
  return analyzeMaterials([material]);
}

export async function askLecture(lectureId: string, question: string): Promise<AskLectureResult> {
  const body = parseAskLectureInput(lectureId, question);
  if (getDataMode() === 'api')
    return parseAskLectureResult(await apiRequest('/ai/ask', { method: 'POST', body }));
  if (getDataMode() !== 'supabase')
    throw new Error('Lecture Q&A requires EXPO_PUBLIC_DATA_MODE=supabase.');
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.functions.invoke('ask-lecture', { body });
  if (error) {
    let message = 'Lecture Q&A failed. Check your connection and function deployment.';
    if (error.context instanceof Response) {
      try {
        const result = await error.context.json();
        if (typeof result?.error?.message === 'string') message = result.error.message;
      } catch {
        /* Preserve a useful message for gateway failures. */
      }
    }
    throw new Error(message);
  }
  return parseAskLectureResult(data);
}

export async function generateQuiz(lectureId: string): Promise<GenerateQuizResult> {
  const body = parseQuizInput(lectureId);
  if (getDataMode() === 'api')
    return parseQuizResult(await apiRequest('/ai/quiz', { method: 'POST', body }));
  if (getDataMode() !== 'supabase')
    throw new Error('Quiz generation requires EXPO_PUBLIC_DATA_MODE=supabase.');
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.functions.invoke('generate-quiz', { body });
  if (error) {
    let message = 'Quiz generation failed. Check your connection and function deployment.';
    if (error.context instanceof Response) {
      try {
        const result = await error.context.json();
        if (typeof result?.error?.message === 'string') message = result.error.message;
      } catch {
        /* Keep a useful message for gateway failures. */
      }
    }
    throw new Error(message);
  }
  return parseQuizResult(data);
}
