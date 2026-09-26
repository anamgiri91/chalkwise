import type { LectureEdit, NoteListKey, NoteSources } from './types.ts';

export type EditorLine = { text: string; source: number | null };
const KEYS: NoteListKey[] = ['keyConcepts', 'importantPoints', 'assignments', 'examMentions'];

/**
 * Turn the editor's lines back into notes. Each line keeps the photo it came from, so a
 * corrected line still opens its original; blank lines are dropped with their source.
 */
export function toEdit(
  title: string,
  summary: string,
  lists: Record<NoteListKey, EditorLine[]>,
): LectureEdit {
  const sources: NoteSources = {};
  const edit = { title: title.trim(), summary: summary.trim() } as LectureEdit;
  for (const key of KEYS) {
    const kept = lists[key]
      .map((line) => ({ ...line, text: line.text.trim() }))
      .filter((line) => line.text);
    edit[key] = kept.map((line) => line.text);
    sources[key] = kept.map((line) => line.source);
  }
  return { ...edit, sources };
}
