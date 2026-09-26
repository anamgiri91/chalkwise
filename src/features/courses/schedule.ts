import type { CourseMeeting } from '../../types/study.ts';

/**
 * Class-time logic, all in the student's local time. A capture counts as "in class"
 * from a few minutes before a meeting starts until a while after it ends, because
 * boards are often photographed as the room empties.
 */
export const CAPTURE_WINDOW = { beforeMinutes: 10, afterMinutes: 30 } as const;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function minutesOf(clock: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) throw new Error(`Invalid time ${clock}; use HH:MM.`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "9:30 AM", "1:05 PM". */
export function formatClock(clock: string): string {
  const minutes = minutesOf(clock);
  const hour = Math.floor(minutes / 60);
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${suffix}`;
}

/** "Tue, Thu · 9:30–10:50 AM" for meetings sharing a time, one group per time. */
export function describeMeetings(meetings: CourseMeeting[]): string[] {
  const byTime = new Map<string, number[]>();
  for (const m of meetings) {
    const key = `${m.start}-${m.end}`;
    byTime.set(key, [...(byTime.get(key) ?? []), m.weekday]);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, days]) => {
      const [start, end] = key.split('-');
      const dayList = [...days]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAYS[d])
        .join(', ');
      return `${dayList} · ${formatClock(start)}–${formatClock(end)}`;
    });
}

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

/**
 * The course whose class is on at this moment, or null. When windows overlap
 * (back-to-back classes), the class that has started most recently wins: at 10:52 a
 * student who had 9:30–10:50 and 11:00–11:50 is still photographing the first board.
 */
export function courseInSession(meetings: CourseMeeting[], at: Date): string | null {
  const now = minuteOfDay(at);
  const candidates = meetings
    .filter((m) => m.weekday === at.getDay())
    .filter(
      (m) =>
        now >= minutesOf(m.start) - CAPTURE_WINDOW.beforeMinutes &&
        now <= minutesOf(m.end) + CAPTURE_WINDOW.afterMinutes,
    )
    .sort((a, b) => {
      const startedA = now >= minutesOf(a.start);
      const startedB = now >= minutesOf(b.start);
      if (startedA !== startedB) return startedA ? -1 : 1;
      return startedA
        ? minutesOf(b.start) - minutesOf(a.start)
        : minutesOf(a.start) - minutesOf(b.start);
    });
  return candidates[0]?.courseId ?? null;
}

/** The next class to start after `from`, within the coming week. */
export function nextMeeting(
  meetings: CourseMeeting[],
  from: Date,
): { meeting: CourseMeeting; startsAt: Date } | null {
  let best: { meeting: CourseMeeting; startsAt: Date } | null = null;
  for (const meeting of meetings) {
    for (let offset = 0; offset <= 7; offset++) {
      const day = new Date(from);
      day.setDate(from.getDate() + offset);
      if (day.getDay() !== meeting.weekday) continue;
      const startsAt = new Date(day);
      const start = minutesOf(meeting.start);
      startsAt.setHours(Math.floor(start / 60), start % 60, 0, 0);
      if (startsAt <= from) continue;
      if (!best || startsAt < best.startsAt) best = { meeting, startsAt };
      break;
    }
  }
  return best;
}

/** Every class that met between `from` and `to`, oldest first. */
export function occurrencesBetween(
  meetings: CourseMeeting[],
  from: Date,
  to: Date,
): { meeting: CourseMeeting; startsAt: Date; endsAt: Date }[] {
  const result: { meeting: CourseMeeting; startsAt: Date; endsAt: Date }[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (; day <= to; day.setDate(day.getDate() + 1)) {
    for (const meeting of meetings) {
      if (meeting.weekday !== day.getDay()) continue;
      const startsAt = new Date(day);
      const endsAt = new Date(day);
      const start = minutesOf(meeting.start);
      const end = minutesOf(meeting.end);
      startsAt.setHours(Math.floor(start / 60), start % 60, 0, 0);
      endsAt.setHours(Math.floor(end / 60), end % 60, 0, 0);
      if (startsAt >= from && endsAt <= to) result.push({ meeting, startsAt, endsAt });
    }
  }
  return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Read a time the way people type it: "9:30", "930", "9:30 am", "1:05PM", "13:05".
 * Returns "HH:MM" or null. A bare hour from 1 to 6 is read as afternoon, since classes
 * rarely start before 7 am.
 */
export function parseTimeInput(value: string): string | null {
  const match = /^\s*(\d{1,2})(?::?(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(value);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === 'p' ? 12 : 0);
  } else if (hour >= 1 && hour <= 6) {
    hour += 12;
  }
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export type MeetingGroup = { days: number[]; start: string; end: string };

/** Class times as the editor shows them: one row per time, with its days. */
export function groupMeetings(meetings: CourseMeeting[]): MeetingGroup[] {
  const groups = new Map<string, MeetingGroup>();
  for (const m of meetings) {
    const key = `${m.start}-${m.end}`;
    const group = groups.get(key) ?? { days: [], start: m.start, end: m.end };
    group.days.push(m.weekday);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, days: [...new Set(g.days)].sort((a, b) => a - b) }))
    .sort((a, b) => a.start.localeCompare(b.start));
}
