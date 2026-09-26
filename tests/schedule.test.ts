import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courseInSession,
  describeMeetings,
  formatClock,
  minutesOf,
  nextMeeting,
  occurrencesBetween,
} from '../src/features/courses/schedule.ts';

// Tuesday 29 September 2026, local time.
const tue = (hour: number, minute = 0) => new Date(2026, 8, 29, hour, minute);
const meetings = [
  { courseId: 'cs-3358', weekday: 2, start: '09:30', end: '10:50' },
  { courseId: 'cs-3358', weekday: 4, start: '09:30', end: '10:50' },
  { courseId: 'math-3398', weekday: 2, start: '11:00', end: '11:50' },
];

test('times parse and format for people', () => {
  assert.equal(minutesOf('09:30'), 570);
  assert.throws(() => minutesOf('9:30'));
  assert.equal(formatClock('00:05'), '12:05 AM');
  assert.equal(formatClock('13:00'), '1:00 PM');
  assert.deepEqual(describeMeetings(meetings.slice(0, 2)), ['Tue, Thu · 9:30 AM–10:50 AM']);
});

test('a capture during class, or just around it, belongs to that class', () => {
  assert.equal(courseInSession(meetings, tue(9, 45)), 'cs-3358');
  assert.equal(courseInSession(meetings, tue(9, 22)), 'cs-3358', 'ten minutes early');
  assert.equal(courseInSession(meetings, tue(11, 30)), 'math-3398');
  assert.equal(courseInSession(meetings, tue(13, 0)), null, 'no class');
  assert.equal(courseInSession(meetings, new Date(2026, 8, 28, 9, 45)), null, 'wrong day');
});

test('between back-to-back classes the one that already started wins', () => {
  // 10:55 is inside CS's 30-minute tail and Math's 10-minute lead.
  assert.equal(courseInSession(meetings, tue(10, 55)), 'cs-3358');
  // Once Math starts, it wins.
  assert.equal(courseInSession(meetings, tue(11, 5)), 'math-3398');
});

test('the next class and the classes in a period are found across days', () => {
  const next = nextMeeting(meetings, tue(12, 0));
  assert.equal(next?.meeting.weekday, 4);
  assert.deepEqual(next?.startsAt, new Date(2026, 9, 1, 9, 30));
  const week = occurrencesBetween(meetings, new Date(2026, 8, 27), tue(12, 0));
  assert.deepEqual(
    week.map((o) => `${o.meeting.courseId}@${o.startsAt.getDate()}`),
    ['cs-3358@29', 'math-3398@29'],
  );
});

test('typed times are read the way students write them', async () => {
  const { parseTimeInput, groupMeetings } = await import('../src/features/courses/schedule.ts');
  assert.equal(parseTimeInput('9:30'), '09:30');
  assert.equal(parseTimeInput('930'), '09:30');
  assert.equal(parseTimeInput('9:30 am'), '09:30');
  assert.equal(parseTimeInput('1:05PM'), '13:05');
  assert.equal(parseTimeInput('12 pm'), '12:00');
  assert.equal(parseTimeInput('12am'), '00:00');
  assert.equal(parseTimeInput('2:15'), '14:15', 'a bare early hour is afternoon');
  assert.equal(parseTimeInput('13:05'), '13:05');
  assert.equal(parseTimeInput('9:75'), null);
  assert.equal(parseTimeInput('25:00'), null);
  assert.equal(parseTimeInput('soon'), null);
  assert.deepEqual(groupMeetings(meetings), [
    { days: [2, 4], start: '09:30', end: '10:50' },
    { days: [2], start: '11:00', end: '11:50' },
  ]);
});
