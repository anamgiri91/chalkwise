import { mockLectures } from '@/features/lectures/mockData';
import { getDataMode } from '@/lib/dataMode';
import { apiRequest } from '@/lib/api';
import { getApiSession } from '@/lib/cognito';
import type { CreateLectureInput, Lecture, LectureEdit } from '@/types';
import { getCourse } from './courses';
import { occurrencesBetween } from '@/features/courses/schedule';

type LectureRow = {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  key_concepts: string[];
  important_points: string[];
  assignments: string[];
  exam_mentions: string[];
  created_at: string;
};

// lecture_date is intentionally omitted: Lecture has no lectureDate field yet.
const lectureColumns =
  'id, course_id, title, summary, key_concepts, important_points, assignments, exam_mentions, created_at';

function fromRow(row: LectureRow): Lecture {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    summary: row.summary,
    keyConcepts: row.key_concepts,
    importantPoints: row.important_points,
    assignments: row.assignments,
    examMentions: row.exam_mentions,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function copy(lecture: Lecture): Lecture {
  return {
    ...lecture,
    ...(lecture.sources
      ? {
          sources: Object.fromEntries(
            Object.entries(lecture.sources).map(([key, refs]) => [key, [...(refs ?? [])]]),
          ),
        }
      : {}),
    keyConcepts: [...lecture.keyConcepts],
    importantPoints: [...lecture.importantPoints],
    assignments: [...lecture.assignments],
    examMentions: [...lecture.examMentions],
  };
}

const lectures = mockLectures.map(copy);

/**
 * The offline demo's one classmate note, dated to the most recent Data Structures class
 * so weekly catch-up always has something to show. It is read-only and labelled as a demo.
 */
export const DEMO_CLASSMATE_ID = 'demo-classmate';
const DEMO_SHARED_ID = 'demo-shared-avl-rotations';
let demoShared: (Lecture & { ownerId: string }) | null = null;
function demoSharedLecture(): Lecture & { ownerId: string } {
  if (demoShared) return demoShared;
  const now = new Date();
  const classes = occurrencesBetween(
    [
      { courseId: 'cs-3358', weekday: 2, start: '09:30', end: '10:50' },
      { courseId: 'cs-3358', weekday: 4, start: '09:30', end: '10:50' },
    ],
    new Date(now.getTime() - 7 * 86_400_000),
    now,
  );
  const last = classes.at(-1)?.endsAt ?? new Date(now.getTime() - 2 * 86_400_000);
  demoShared = {
    id: DEMO_SHARED_ID,
    ownerId: DEMO_CLASSMATE_ID,
    courseId: 'cs-3358',
    title: 'AVL Rotations',
    summary:
      'AVL trees stay balanced by checking each node’s balance factor after an insert and rotating when it leaves the range −1 to 1.',
    keyConcepts: ['Balance factor', 'Single rotations (LL, RR)', 'Double rotations (LR, RL)'],
    importantPoints: [
      'Balance factor = height(left) − height(right).',
      'An AVL tree’s height stays O(log n), so search stays O(log n).',
    ],
    assignments: ['Program 2: AVL insert and delete.'],
    examMentions: ['Rotations will be on Exam 1.'],
    createdAt: new Date(last.getTime() - 5 * 60_000).toISOString(),
  };
  return demoShared;
}
export function isDemoSharedLecture(id: string): boolean {
  return id === DEMO_SHARED_ID;
}
let nextId = 1;
const apiSaveKeys = new Map<string, string>();

export async function getLectures(courseId: string): Promise<Lecture[]> {
  if (getDataMode() === 'api')
    return apiRequest(`/lectures?courseId=${encodeURIComponent(courseId)}`);
  if (getDataMode() === 'mock') {
    return lectures
      .filter((lecture) => lecture.courseId === courseId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .map(copy);
  }

  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase
    .from('lectures')
    .select(lectureColumns)
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .order('id')
    .returns<LectureRow[]>();

  if (error) throw new Error(`Could not load lectures: ${error.message}`);
  return data.map(fromRow);
}

export async function getLecture(id: string): Promise<Lecture | null> {
  if (getDataMode() === 'api') return apiRequest(`/lectures/${encodeURIComponent(id)}`);
  if (getDataMode() === 'mock') {
    if (isDemoSharedLecture(id)) return copy(demoSharedLecture());
    const lecture = lectures.find((item) => item.id === id);
    return lecture ? copy(lecture) : null;
  }

  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase
    .from('lectures')
    .select(lectureColumns)
    .eq('id', id)
    .returns<LectureRow[]>()
    .maybeSingle();

  if (error) throw new Error(`Could not load lecture: ${error.message}`);
  return data ? fromRow(data) : null;
}

/** Persist in Supabase mode; keep the local demo independent in mock mode. */
export async function createLecture(input: CreateLectureInput): Promise<Lecture> {
  if (getDataMode() === 'api') {
    const session = await getApiSession();
    if (!session) throw new Error('Sign in to save a notebook.');
    const signature = `${session.userId}:${JSON.stringify(input)}`;
    const { randomUUID } = await import('expo-crypto');
    const key = apiSaveKeys.get(signature) ?? randomUUID();
    apiSaveKeys.set(signature, key);
    const lecture = await apiRequest<Lecture>('/lectures', {
      method: 'POST',
      body: input,
      idempotencyKey: key,
    });
    apiSaveKeys.delete(signature);
    return lecture;
  }
  if (!(await getCourse(input.courseId))) throw new Error('Course not found.');
  if (getDataMode() === 'mock') {
    const lecture = copy({
      ...input,
      id: `local-lecture-${nextId++}`,
      createdAt: new Date().toISOString(),
    });
    lectures.unshift(lecture);
    return copy(lecture);
  }
  const { randomUUID } = await import('expo-crypto');
  const { supabase } = await import('@/lib/supabase');
  const id = randomUUID();
  // owner_id is what makes a lecture yours, and what Catch Up shares by.
  const { data: auth } = await supabase.auth.getSession();
  const ownerId = auth.session?.user.id;
  if (!ownerId) throw new Error('You are signed out. Sign in and try again.');
  const { data, error } = await supabase
    .from('lectures')
    .insert({
      id,
      course_id: input.courseId,
      title: input.title,
      summary: input.summary,
      key_concepts: input.keyConcepts,
      important_points: input.importantPoints,
      assignments: input.assignments,
      exam_mentions: input.examMentions,
      owner_id: ownerId,
    })
    .select(lectureColumns)
    .returns<LectureRow[]>()
    .single();
  if (error) throw new Error(`Could not create lecture (attempted ID ${id}): ${error.message}`);
  if (!data) throw new Error(`No saved lecture was returned (attempted ID ${id}).`);
  return fromRow(data);
}

/**
 * Save the owner's corrections to generated notes. Originals are never touched, and
 * the notebook is marked as edited so readers know a person changed it.
 */
export async function updateLecture(id: string, edit: LectureEdit): Promise<Lecture> {
  if (getDataMode() === 'api')
    return apiRequest(`/lectures/${encodeURIComponent(id)}`, { method: 'PUT', body: edit });
  if (getDataMode() !== 'mock')
    throw new Error('Editing notes is available on the new Chalkwise backend.');
  const index = lectures.findIndex((lecture) => lecture.id === id);
  if (index < 0) throw new Error('Notebook not found.');
  lectures[index] = copy({ ...lectures[index], ...edit, editedAt: new Date().toISOString() });
  return copy(lectures[index]);
}

/** A friend's lecture, carrying who shared it so the UI can credit them. */
export type SharedLecture = Lecture & { ownerId: string };

/** Catch Up: lectures shared by the given classmates, newest first. */
export async function getLecturesByOwners(ownerIds: string[]): Promise<SharedLecture[]> {
  if (getDataMode() === 'api')
    return ownerIds.length
      ? apiRequest(`/shared-lectures?owners=${encodeURIComponent(ownerIds.slice(0, 40).join(','))}`)
      : [];
  if (getDataMode() === 'mock')
    return ownerIds.includes(DEMO_CLASSMATE_ID)
      ? [{ ...copy(demoSharedLecture()), ownerId: DEMO_CLASSMATE_ID }]
      : [];
  if (getDataMode() !== 'supabase' || !ownerIds.length) return [];
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase
    .from('lectures')
    .select(`${lectureColumns}, owner_id`)
    .in('owner_id', ownerIds)
    .order('created_at', { ascending: false })
    .order('id')
    .returns<(LectureRow & { owner_id: string })[]>();
  if (error) throw new Error(`Could not load shared lectures: ${error.message}`);
  return data.map((row) => ({ ...fromRow(row), ownerId: row.owner_id }));
}

/** Copy saved analysis and real captures; retries resume the same user's copy. */
export async function copyLectureToMyNotes(lectureId: string, courseId?: string): Promise<Lecture> {
  if (getDataMode() === 'api') {
    if (courseId && (await getLecture(lectureId))?.courseId !== courseId)
      throw new Error('Shared notes must stay in their matching course.');
    return apiRequest(`/lectures/${encodeURIComponent(lectureId)}/copy`, { method: 'POST' });
  }
  if (getDataMode() === 'mock') {
    if (!isDemoSharedLecture(lectureId)) throw new Error('That shared notebook is not available.');
    const id = `copy-${lectureId}`;
    const existing = lectures.find((lecture) => lecture.id === id);
    if (existing) return copy(existing);
    const { ownerId: _owner, ...source } = demoSharedLecture();
    const saved = copy({ ...source, id, createdAt: new Date().toISOString() });
    lectures.unshift(saved);
    return copy(saved);
  }
  if (getDataMode() !== 'supabase')
    throw new Error('Catch Up requires EXPO_PUBLIC_DATA_MODE=supabase.');
  const { supabase } = await import('@/lib/supabase');
  const { copyLectureMaterials } = await import('./materials');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in to add these notes.');
  const source = await getLecture(lectureId);
  if (!source) throw new Error('That shared lecture is no longer available.');
  if (courseId && courseId !== source.courseId)
    throw new Error('Shared notes must stay in their matching course.');
  const id = `catchup:${auth.user.id}:${source.id}`;
  let saved = await getLecture(id);
  if (!saved) {
    const { data, error } = await supabase
      .from('lectures')
      .insert({
        id,
        owner_id: auth.user.id,
        course_id: source.courseId,
        title: source.title,
        summary: source.summary,
        key_concepts: source.keyConcepts,
        important_points: source.importantPoints,
        assignments: source.assignments,
        exam_mentions: source.examMentions,
      })
      .select(lectureColumns)
      .returns<LectureRow[]>()
      .single();
    // Recover a concurrent insert or a committed insert with a lost response.
    saved = data ? fromRow(data) : await getLecture(id);
    if (!saved)
      throw new Error(`Could not copy lecture: ${error?.message ?? 'No saved lecture returned.'}`);
  }
  await copyLectureMaterials(source.id, saved.id);
  return saved;
}
