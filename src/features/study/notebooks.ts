import type { Course } from '../courses/types.ts';
import type { Lecture } from '../lectures/types.ts';

export type NotebookFilters = {
  query?: string;
  courseId?: string;
  dueIds?: ReadonlySet<string>;
  sort?: 'recent' | 'title';
};

/** Search and ordering share one contract across the overview and full library. */
export function selectNotebooks(notes: Lecture[], courses: Course[], filters: NotebookFilters = {}) {
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const query = (filters.query ?? '').trim().toLocaleLowerCase();
  return notes.filter((note) => {
    if (filters.courseId && note.courseId !== filters.courseId) return false;
    if (filters.dueIds && !filters.dueIds.has(note.id)) return false;
    const course = coursesById.get(note.courseId);
    return !query || [note.title, note.summary, ...note.keyConcepts, course?.code, course?.name]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
  }).sort((a, b) => filters.sort === 'title'
    ? a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    : b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title));
}
