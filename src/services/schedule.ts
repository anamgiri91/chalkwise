import { getDataMode } from '@/lib/dataMode';
import { apiRequest } from '@/lib/api';
import { minutesOf } from '@/features/courses/schedule';
import type { CourseMeeting } from '@/types';

/** Demo class times, so course detection and catch-up work in the offline demo. */
let demoMeetings: CourseMeeting[] = [
  { courseId: 'cs-3358', weekday: 2, start: '09:30', end: '10:50' },
  { courseId: 'cs-3358', weekday: 4, start: '09:30', end: '10:50' },
  { courseId: 'math-3398', weekday: 1, start: '13:00', end: '14:15' },
  { courseId: 'math-3398', weekday: 3, start: '13:00', end: '14:15' },
];

export function scheduleAvailable(): boolean {
  return getDataMode() !== 'supabase';
}

/** Every weekly class time the student has entered, across their courses. */
export async function getMeetings(): Promise<CourseMeeting[]> {
  if (getDataMode() === 'api') return apiRequest('/meetings');
  if (getDataMode() === 'mock') return demoMeetings.map((m) => ({ ...m }));
  return [];
}

type MeetingInput = Omit<CourseMeeting, 'courseId'>;

/** Replace one course's class times. An empty list clears them. */
export async function setCourseMeetings(
  courseId: string,
  meetings: MeetingInput[],
): Promise<CourseMeeting[]> {
  for (const m of meetings)
    if (minutesOf(m.end) <= minutesOf(m.start))
      throw new Error('A class must end after it starts.');
  if (getDataMode() === 'api')
    return apiRequest(`/courses/${encodeURIComponent(courseId)}/meetings`, {
      method: 'PUT',
      body: { meetings },
    });
  if (getDataMode() !== 'mock')
    throw new Error('Class times are available on the new Chalkwise backend.');
  demoMeetings = [
    ...demoMeetings.filter((m) => m.courseId !== courseId),
    ...meetings.map((m) => ({ ...m, courseId })),
  ];
  return demoMeetings.filter((m) => m.courseId === courseId).map((m) => ({ ...m }));
}
