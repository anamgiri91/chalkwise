import { getDataMode } from '@/lib/dataMode';
import { getCourses } from './courses';
import { getFriends, getProfileById } from './friends';
import { DEMO_CLASSMATE_ID, getLecture, getLecturesByOwners } from './lectures';
import { getMeetings } from './schedule';
import { getStudyDashboard } from './study';
import { catchupWindow, findClassGaps, type ClassGap } from '@/features/study/catchup';
import { occurrencesBetween } from '@/features/courses/schedule';
import type { Course, Lecture, Profile } from '@/types';

export type CatchupNote = { lecture: Lecture; course?: Course; sharedBy?: Profile; demo?: boolean };
/** A class this week with no notes of your own, and what classmates shared from it. */
export type CatchupGap = Omit<ClassGap, 'shared'> & { course?: Course; notes: CatchupNote[] };

const demoClassmate: Profile = {
  id: DEMO_CLASSMATE_ID,
  name: 'Jordan Lee',
  year: 'Junior',
  major: 'Computer Science',
};

/** Pass the student's own notebooks when already loaded, to skip loading them again. */
export async function getCatchupFeed(mine?: Lecture[]): Promise<{
  friends: Profile[];
  notes: CatchupNote[];
  gaps: CatchupGap[];
}> {
  const mock = getDataMode() === 'mock';
  const [realFriends, courses, meetings, dashboard] = await Promise.all([
    getFriends(),
    getCourses(),
    getMeetings().catch(() => []),
    mine ? { lectures: mine } : getStudyDashboard().catch(() => null),
  ]);
  const friends = mock ? [demoClassmate] : realFriends;
  const shared = await getLecturesByOwners(friends.map((friend) => friend.id));
  const notes: CatchupNote[] = shared.map((lecture) => ({
    lecture,
    course: courses.find((c) => c.id === lecture.courseId),
    sharedBy: friends.find((f) => f.id === lecture.ownerId),
    demo: mock || undefined,
  }));
  // Keep the verified existing demo available only in its original adapter.
  if (
    getDataMode() === 'supabase' &&
    !notes.some((note) => note.lecture.id === 'demo-prashant-lecture')
  ) {
    const lecture = await getLecture('demo-prashant-lecture');
    if (lecture)
      notes.push({
        lecture,
        course: courses.find((c) => c.id === lecture.courseId),
        sharedBy: (await getProfileById('d3405e91-5a2b-4c77-9f61-0b8a7c2d4e10')) ?? undefined,
        demo: true,
      });
  }
  const byId = new Map(notes.map((note) => [note.lecture.id, note]));
  const { from, to } = catchupWindow();
  const gaps = findClassGaps(
    occurrencesBetween(meetings, from, to),
    dashboard?.lectures ?? [],
    notes.map((note) => note.lecture),
  ).map(({ shared: fromClass, ...gap }) => ({
    ...gap,
    course: courses.find((c) => c.id === gap.courseId),
    notes: fromClass.flatMap((lecture) => byId.get(lecture.id) ?? []),
  }));
  return { friends, notes, gaps };
}
