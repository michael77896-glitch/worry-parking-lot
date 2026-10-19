import * as Notifications from 'expo-notifications';

/**
 * Local-only reminders. Everything here is scheduled on the phone: there is no push
 * server and no token. The reminder text is fixed and must never include worry text.
 */

const REMINDER_ID = 'worry-window-daily';

export type ReminderPermission = 'granted' | 'undetermined' | 'denied';

/** Call once at startup so reminders also show as a banner while the app is open. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/** Shows the iPhone permission prompt if it hasn't been shown yet. Returns true if allowed. */
export async function requestReminderPermission(): Promise<boolean> {
  const status = await Notifications.requestPermissionsAsync();
  return status.granted;
}

/** Replaces any existing reminder with one every day at `startMinutes` (local time). */
export async function scheduleWindowReminder(startMinutes: number): Promise<void> {
  await cancelWindowReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Your worry window is open',
      body: 'Your parked worries are ready whenever you want to look at them.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Math.floor(startMinutes / 60),
      minute: startMinutes % 60,
    },
  });
}

export async function cancelWindowReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
}
