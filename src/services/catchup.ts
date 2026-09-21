import { getDataMode } from '@/lib/dataMode';
import { getCourses } from './courses';
import { getFriends, getProfileById } from './friends';
import { getLecture, getLecturesByOwners } from './lectures';
import type { Course, Lecture, Profile } from '@/types';

export type CatchupNote = { lecture: Lecture; course?: Course; sharedBy?: Profile; demo?: boolean };
export async function getCatchupFeed(): Promise<{ friends: Profile[]; notes: CatchupNote[] }> {
  const [friends, courses] = await Promise.all([getFriends(), getCourses()]);
  const shared = await getLecturesByOwners(friends.map((friend) => friend.id));
  const notes: CatchupNote[] = shared.map((lecture) => ({
    lecture,
    course: courses.find((c) => c.id === lecture.courseId),
    sharedBy: friends.find((f) => f.id === lecture.ownerId),
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
  return { friends, notes };
}
