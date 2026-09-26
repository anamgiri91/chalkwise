import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_REMINDERS,
  planReminders,
  withinReminderHours,
} from '../src/features/study/reminders.ts';

// Local times, so the quiet-hours rules are tested the way a student experiences them.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

test('reminders never land before 9 am or after 9 pm', () => {
  assert.deepEqual(withinReminderHours(at(26, 7, 30)), at(26, 9));
  assert.deepEqual(withinReminderHours(at(26, 14, 15)), at(26, 14, 15));
  assert.deepEqual(withinReminderHours(at(26, 21, 0)), at(27, 9));
  assert.deepEqual(withinReminderHours(at(26, 23, 45)), at(27, 9));
});

test('only upcoming reviews get a reminder; overdue ones are already on the home screen', () => {
  const plan = planReminders(
    [
      { lectureId: 'a', title: 'Graphs', dueAt: at(26, 8).toISOString() },
      { lectureId: 'b', title: 'Trees', dueAt: at(26, 15).toISOString() },
      { lectureId: 'c', title: 'Broken', dueAt: 'not a date' },
    ],
    at(26, 10),
  );
  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].lectureIds, ['b']);
  assert.equal(plan[0].title, 'Time to review Trees');
});

test('reviews due within an hour of each other share one reminder', () => {
  const plan = planReminders(
    [
      { lectureId: 'a', title: 'Graphs', dueAt: at(27, 2).toISOString() },
      { lectureId: 'b', title: 'Trees', dueAt: at(27, 5).toISOString() },
      { lectureId: 'c', title: 'Heaps', dueAt: at(27, 9, 30).toISOString() },
      { lectureId: 'd', title: 'Sorting', dueAt: at(27, 16).toISOString() },
    ],
    at(26, 12),
  );
  // Overnight reviews all move to 9 am and merge with the 9:30 one.
  assert.equal(plan.length, 2);
  assert.deepEqual(plan[0].at, at(27, 9));
  assert.deepEqual(plan[0].lectureIds, ['a', 'b', 'c']);
  assert.equal(plan[0].title, '3 notebooks are ready to review');
  assert.equal(plan[0].body, 'Graphs, Trees and more.');
  assert.deepEqual(plan[1].lectureIds, ['d']);
});

test('the plan is capped so the operating system never drops reminders', () => {
  const items = Array.from({ length: 80 }, (_, i) => ({
    lectureId: `n${i}`,
    title: `Notebook ${i}`,
    dueAt: new Date(at(27, 10).getTime() + i * 2 * 3_600_000).toISOString(),
  }));
  const plan = planReminders(items, at(26, 12));
  assert.equal(plan.length, MAX_REMINDERS);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at > plan[i - 1].at);
});
