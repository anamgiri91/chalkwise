import type { LectureAnalysis, NoteListKey, NoteSources } from '../features/lectures/types.ts';

export const NOTE_LISTS: readonly NoteListKey[] = [
  'keyConcepts',
  'importantPoints',
  'assignments',
  'examMentions',
];
/** Photo numbers are 1-based and a capture session holds at most six photos. */
const MAX_PHOTO = 6;

const photoNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_PHOTO
    ? value
    : null;

/**
 * Validate note lists and their optional sources together, so dropping a blank line
 * never shifts a source onto the wrong line. Sources whose length does not match
 * their list are discarded rather than guessed.
 */
export function parseNoteLists(
  row: Record<string, unknown>,
): Record<NoteListKey, string[]> & { sources?: NoteSources } {
  const rawSources =
    row.sources && typeof row.sources === 'object' && !Array.isArray(row.sources)
      ? (row.sources as Record<string, unknown>)
      : null;
  const lists = {} as Record<NoteListKey, string[]>;
  const sources: NoteSources = {};
  for (const key of NOTE_LISTS) {
    const value = row[key];
    if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string'))
      throw new Error(`Invalid analysis field: ${key}.`);
    const given = rawSources?.[key];
    const aligned = Array.isArray(given) && given.length === value.length ? given : null;
    lists[key] = [];
    const kept: (number | null)[] = [];
    value.forEach((item, index) => {
      const line = item.trim();
      if (!line) return;
      lists[key].push(line);
      if (aligned) kept.push(photoNumber(aligned[index]));
    });
    if (aligned) sources[key] = kept;
  }
  return Object.keys(sources).length ? { ...lists, sources } : lists;
}

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
  if (row.suggestedCourse !== null && typeof row.suggestedCourse !== 'string') {
    throw new Error('Invalid analysis field: suggestedCourse.');
  }
  return {
    suggestedCourse: row.suggestedCourse === null ? null : row.suggestedCourse.trim() || null,
    title: requiredString('title'),
    topic: requiredString('topic'),
    summary: requiredString('summary'),
    ...parseNoteLists(row),
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
  // Sources are computed from the transcripts, never taken from the organizer.
  const analysis = parseLectureAnalysis({
    ...(value as Record<string, unknown>),
    suggestedCourse: null,
    sources: undefined,
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
