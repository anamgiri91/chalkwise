import type { LectureAnalysis } from '../features/lectures/types.ts';

/** Validate untrusted JSON at both the Edge and mobile service boundaries. */
export function parseLectureAnalysis(value: unknown): LectureAnalysis {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid lecture analysis.');
  const row = value as Record<string, unknown>;
  const requiredString = (key: string): string => {
    const value = row[key];
    if (typeof value !== 'string' || !value.trim())
      throw new Error(`Invalid analysis field: ${key}.`);
    return value.trim();
  };
  const strings = (key: string): string[] => {
    const value = row[key];
    if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
      throw new Error(`Invalid analysis field: ${key}.`);
    }
    return value.map((item) => item.trim()).filter(Boolean);
  };
  if (row.suggestedCourse !== null && typeof row.suggestedCourse !== 'string') {
    throw new Error('Invalid analysis field: suggestedCourse.');
  }
  return {
    suggestedCourse: row.suggestedCourse === null ? null : row.suggestedCourse.trim() || null,
    title: requiredString('title'),
    topic: requiredString('topic'),
    summary: requiredString('summary'),
    keyConcepts: strings('keyConcepts'),
    importantPoints: strings('importantPoints'),
    assignments: strings('assignments'),
    examMentions: strings('examMentions'),
  };
}

/** Study material organized from transcripts. The course label is decided separately. */
export type LectureOrganization = Omit<LectureAnalysis, 'suggestedCourse'>;

/**
 * Validate the organizing step against the saved-lecture contract, so organization can
 * never drift from what a notebook stores. The course suggestion comes from the photos
 * rather than the organizer, so it is pinned to null before validation.
 */
export function parseLectureOrganization(value: unknown): LectureOrganization {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid lecture organization.');
  }
  const analysis = parseLectureAnalysis({
    ...(value as Record<string, unknown>),
    suggestedCourse: null,
  });
  return {
    title: analysis.title,
    topic: analysis.topic,
    summary: analysis.summary,
    keyConcepts: analysis.keyConcepts,
    importantPoints: analysis.importantPoints,
    assignments: analysis.assignments,
    examMentions: analysis.examMentions,
  };
}
