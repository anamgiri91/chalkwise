import test from 'node:test';
import assert from 'node:assert/strict';
import { catchupWindow, findClassGaps as gapsFrom } from '../src/features/study/catchup.ts';
import { occurrencesBetween } from '../src/features/courses/schedule.ts';
import type { Lecture } from '../src/features/lectures/types.ts';

const meetings = [
  { courseId: 'cs', weekday: 2, start: '09:30', end: '10:50' },
  { courseId: 'cs', weekday: 4, start: '09:30', end: '10:50' },
];
const note = (id: string, courseId: string, at: Date): Lecture => ({
  id,
  courseId,
  title: id,
  summary: '',
  keyConcepts: [],
  importantPoints: [],
  assignments: [],
  examMentions: [],
  createdAt: at.toISOString(),
});
const findClassGaps = (schedule: typeof meetings, mine: Lecture[], shared: Lecture[], at: Date) => {
  const { from, to } = catchupWindow(at);
  return gapsFrom(occurrencesBetween(schedule, from, to), mine, shared);
};
// Friday 2 October 2026; the week covers Tue 29 Sep and Thu 1 Oct.
const now = new Date(2026, 9, 2, 12, 0);

test('a class with no notes of your own is a gap, with what classmates shared from it', () => {
  const mine = [note('thu-mine', 'cs', new Date(2026, 9, 1, 10, 45))];
  const shared = [
    note('tue-friend', 'cs', new Date(2026, 8, 29, 10, 40)),
    note('tue-evening', 'cs', new Date(2026, 8, 29, 20, 0)),
    note('other-course', 'math', new Date(2026, 8, 29, 10, 0)),
    note('last-week', 'cs', new Date(2026, 8, 22, 10, 0)),
  ];
  const gaps = findClassGaps(meetings, mine, shared, now);
  assert.equal(gaps.length, 1, 'Thursday has your own notes');
  assert.deepEqual(gaps[0].startsAt, new Date(2026, 8, 29, 9, 30));
  assert.deepEqual(
    gaps[0].shared.map((n) => n.id),
    ['tue-evening', 'tue-friend'],
  );
});

test('notes saved the evening after class still count as notes from that class', () => {
  const mine = [
    note('tue-late', 'cs', new Date(2026, 8, 29, 21, 0)),
    note('thu', 'cs', new Date(2026, 9, 1, 9, 25)),
  ];
  assert.deepEqual(findClassGaps(meetings, mine, [], now), []);
});

test('a class still in progress is not a gap, and newest gaps come first', () => {
  // Thursday 10:00: Thursday's class is running, and 24 Sep began before the 7-day window.
  const during = new Date(2026, 9, 1, 10, 0);
  assert.deepEqual(
    findClassGaps(meetings, [], [], during).map((g) => g.startsAt.getDate()),
    [29],
  );
  assert.deepEqual(
    findClassGaps(meetings, [], [], now).map((g) => g.startsAt.getDate()),
    [1, 29],
  );
});
