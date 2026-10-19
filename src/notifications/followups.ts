import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getRemindersEnabled, getSettings, listUpcomingFollowUps, nextWindowOpen } from '@/data';

import { getReminderPermission } from './reminders';

/**
 * One local notification per worry whose check-in is coming up, delivered when the user's
 * worry window opens on or after the due date. The text is fixed and never contains worry text.
 * Only scheduled while the user has daily reminders turned on and allowed.
 */

const PREFIX = 'followup-';
/** iPhone keeps at most 64 pending local notifications; leave room for the daily reminder. */
const MAX_SCHEDULED = 50;

export const FOLLOW_UP_SCREEN = 'followup';

async function doSync(db: SQLiteDatabase): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  if (!(await getRemindersEnabled(db))) return;
  if ((await getReminderPermission()) !== 'granted') return;

  const settings = await getSettings(db);
  const upcoming = (await listUpcomingFollowUps(db)).slice(0, MAX_SCHEDULED);
  for (const item of upcoming) {
    const due = new Date(item.followUpDueAt);
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${item.id}`,
      content: {
        title: 'A quick check-in',
        body: 'A worry you parked a week ago is ready for a quick look back.',
        data: { screen: FOLLOW_UP_SCREEN },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextWindowOpen(new Date(due.getTime() - 1), settings),
      },
    });
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Rebuilds all check-in notifications from the database. Safe to call any time (after a review,
 * an answer, or a settings change). Calls run one after another, and failures are swallowed
 * so a notification problem never blocks the screen that triggered it.
 */
export function syncFollowUpReminders(db: SQLiteDatabase): Promise<void> {
  queue = queue.then(() => doSync(db)).catch(() => {});
  return queue;
}
