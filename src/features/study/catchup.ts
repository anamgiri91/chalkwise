import type { Lecture } from '../lectures/types.ts';
import type { CourseMeeting } from '../../types/study.ts';

/** A class that took place, as listed by occurrencesBetween in courses/schedule. */
export type ClassOccurrence = { meeting: CourseMeeting; startsAt: Date; endsAt: Date };

/**
 * Weekly catch-up: classes in the past week that the student has no notes from, and
 * what classmates shared from those same classes. Having no notes is not proof of
 * absence, so the wording elsewhere says "no notes from", never "you missed".
 */
export const CATCHUP_DAYS = 7;
/** Notes saved this long after class still count as notes from that class. */
const SAME_CLASS_HOURS = 12;
const EARLY_MINUTES = 10;

export type ClassGap<T extends Lecture = Lecture> = {
  courseId: string;
  startsAt: Date;
  /** Classmates' notes from this class, newest first. */
  shared: T[];
};

function fromClass(lecture: Lecture, courseId: string, startsAt: Date, endsAt: Date): boolean {
  const at = new Date(lecture.createdAt).getTime();
  return (
    lecture.courseId === courseId &&
    at >= startsAt.getTime() - EARLY_MINUTES * 60_000 &&
    at <= endsAt.getTime() + SAME_CLASS_HOURS * 3_600_000
  );
}

/** The period catch-up looks back over, ending now. */
export function catchupWindow(now = new Date()): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - CATCHUP_DAYS * 86_400_000), to: now };
}

/** Classes from `occurrences` (oldest first) with no notes of your own, newest first. */
export function findClassGaps<T extends Lecture>(
  occurrences: ClassOccurrence[],
  mine: Lecture[],
  shared: T[],
): ClassGap<T>[] {
  return occurrences
    .filter(({ meeting, startsAt, endsAt }) =>
      mine.every((lecture) => !fromClass(lecture, meeting.courseId, startsAt, endsAt)),
    )
    .map(({ meeting, startsAt, endsAt }) => ({
      courseId: meeting.courseId,
      startsAt,
      shared: shared
        .filter((lecture) => fromClass(lecture, meeting.courseId, startsAt, endsAt))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }))
    .reverse();
}
