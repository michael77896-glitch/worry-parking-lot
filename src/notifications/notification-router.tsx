import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { FOLLOW_UP_SCREEN } from './followups';
import { REVIEW_SCREEN } from './reminders';

/**
 * Opens the check-in screen when the user taps a check-in notification, including when
 * the tap launched the app. Render it once, after the navigator, in the root layout.
 */
export function NotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handled.current === key) return;
    handled.current = key;

    const screen = response.notification.request.content.data?.screen;
    // Let the navigator finish mounting first when the app was launched by the tap.
    if (screen === FOLLOW_UP_SCREEN) setTimeout(() => router.push('/followup'), 0);
    if (screen === REVIEW_SCREEN) setTimeout(() => router.push('/review'), 0);
  }, [response]);

  return null;
}
