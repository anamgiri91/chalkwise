/**
 * Plans review reminders from the review schedule. Pure logic: the notification
 * service in src/services/reminders.ts schedules whatever this returns.
 *
 * Rules, chosen so reminders help rather than nag:
 * - one reminder when a review becomes due, never for reviews already overdue
 *   (the home screen already lists those);
 * - never before 9:00 or after 21:00 local time; a late review moves to 9:00 next day;
 * - reviews that land within an hour of each other share one reminder;
 * - at most MAX_REMINDERS are scheduled (iOS keeps only 64 per app).
 */
export const REMINDER_HOURS = { start: 9, end: 21 } as const;
export const MAX_REMINDERS = 30;
const MERGE_WINDOW_MS = 60 * 60 * 1000;

export type ReminderInput = { lectureId: string; title: string; dueAt: string };
export type PlannedReminder = { at: Date; lectureIds: string[]; title: string; body: string };

/** Move a time into the allowed hours of the same or next day. */
export function withinReminderHours(date: Date): Date {
  const result = new Date(date);
  if (result.getHours() < REMINDER_HOURS.start) {
    result.setHours(REMINDER_HOURS.start, 0, 0, 0);
  } else if (result.getHours() >= REMINDER_HOURS.end) {
    result.setDate(result.getDate() + 1);
    result.setHours(REMINDER_HOURS.start, 0, 0, 0);
  }
  return result;
}

function copy(titles: string[]): { title: string; body: string } {
  if (titles.length === 1)
    return {
      title: `Time to review ${titles[0]}`,
      body: 'Recall it from memory first, then check your notes.',
    };
  return {
    title: `${titles.length} notebooks are ready to review`,
    body: `${titles.slice(0, 2).join(', ')}${titles.length > 2 ? ' and more' : ''}.`,
  };
}

export function planReminders(items: ReminderInput[], now = new Date()): PlannedReminder[] {
  const upcoming = items
    .map((item) => ({ ...item, due: new Date(item.dueAt) }))
    .filter((item) => Number.isFinite(item.due.getTime()) && item.due.getTime() > now.getTime())
    .map((item) => ({ ...item, at: withinReminderHours(item.due) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.lectureId.localeCompare(b.lectureId));

  const groups: { at: Date; items: typeof upcoming }[] = [];
  for (const item of upcoming) {
    const last = groups[groups.length - 1];
    if (last && item.at.getTime() - last.at.getTime() < MERGE_WINDOW_MS) last.items.push(item);
    else groups.push({ at: item.at, items: [item] });
  }

  return groups.slice(0, MAX_REMINDERS).map((group) => ({
    at: group.at,
    lectureIds: group.items.map((item) => item.lectureId),
    ...copy(group.items.map((item) => item.title)),
  }));
}
