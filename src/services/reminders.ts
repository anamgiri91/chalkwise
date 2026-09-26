import 'expo-sqlite/localStorage/install';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planReminders } from '@/features/study/reminders';
import { getStudyDashboard } from './study';
import type { Lecture, LectureReview } from '@/types';

/**
 * Local review reminders. Notifications are scheduled on the device when a review
 * becomes due, so no push server or device token is involved. The web has no
 * scheduled notifications; it shows due reviews on the home screen instead.
 */
const PREFERENCE_KEY = 'chalkwise.reviewReminders';
const CHANNEL_ID = 'review-reminders';
const KIND = 'review-reminder';

export type ReminderStatus = 'enabled' | 'disabled' | 'denied' | 'unsupported';

export function remindersSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function readPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(PREFERENCE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writePreference(on: boolean) {
  try {
    globalThis.localStorage?.setItem(PREFERENCE_KEY, on ? 'on' : 'off');
  } catch {
    // A lost preference only means reminders stay off; never block the review itself.
  }
}

export async function getReminderStatus(): Promise<ReminderStatus> {
  if (!remindersSupported()) return 'unsupported';
  if (!readPreference()) return 'disabled';
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted ? 'enabled' : 'denied';
}

let handlerInstalled = false;
/** Show reminders that arrive while the app is open, and set up the Android channel. */
export async function prepareReminders() {
  if (!remindersSupported() || handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Review reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
}

async function cancelReviewReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.content.data?.kind === KIND)
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

/**
 * Replace every scheduled review reminder with the current plan. Safe to call often:
 * it only touches Chalkwise review reminders and does nothing when they are off.
 */
export async function syncReviewReminders(lectures: Lecture[], reviews: LectureReview[]) {
  if ((await getReminderStatus()) !== 'enabled') return;
  await prepareReminders();
  const titles = new Map(lectures.map((lecture) => [lecture.id, lecture.title]));
  const plan = planReminders(
    reviews
      .filter((review) => titles.has(review.lectureId))
      .map((review) => ({
        lectureId: review.lectureId,
        title: titles.get(review.lectureId)!,
        dueAt: review.nextReviewAt,
      })),
  );
  await cancelReviewReminders();
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { kind: KIND, lectureId: reminder.lectureIds[0], count: reminder.lectureIds.length },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Ask for permission, remember the choice, and schedule reminders for current reviews. */
export async function enableReviewReminders(
  lectures: Lecture[],
  reviews: LectureReview[],
): Promise<ReminderStatus> {
  if (!remindersSupported()) return 'unsupported';
  await prepareReminders();
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';
  writePreference(true);
  await syncReviewReminders(lectures, reviews);
  return 'enabled';
}

export async function disableReviewReminders(): Promise<ReminderStatus> {
  writePreference(false);
  if (remindersSupported()) await cancelReviewReminders();
  return remindersSupported() ? 'disabled' : 'unsupported';
}

/** The notebook a tapped reminder should open, or null for anything else. */
export function reminderTarget(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data;
  return data?.kind === KIND && typeof data.lectureId === 'string' ? data.lectureId : null;
}

/**
 * Call back with the notebook ID when a reminder is tapped, including the tap that
 * launched the app. Returns an unsubscribe function; a no-op on the web.
 */
export function onReminderOpened(open: (lectureId: string) => void): () => void {
  if (!remindersSupported()) return () => {};
  const launch = reminderTarget(Notifications.getLastNotificationResponse());
  if (launch) {
    open(launch);
    Notifications.clearLastNotificationResponse();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const target = reminderTarget(response);
    if (target) open(target);
  });
  return () => subscription.remove();
}

/** Reschedule from the latest reviews, e.g. right after a review is saved. */
export async function refreshReviewReminders() {
  if ((await getReminderStatus()) !== 'enabled') return;
  const { lectures, reviews } = await getStudyDashboard();
  await syncReviewReminders(lectures, reviews);
}

/** Turn reminders on using the student's current notebooks and reviews. */
export async function turnOnReviewReminders(): Promise<ReminderStatus> {
  if (!remindersSupported()) return 'unsupported';
  const { lectures, reviews } = await getStudyDashboard();
  return enableReviewReminders(lectures, reviews);
}
