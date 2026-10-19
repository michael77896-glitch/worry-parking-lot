import { Alert } from 'react-native';

import { isTestWindowActive, setTestWindow } from '@/data';
import { sendTestReminder } from '@/notifications/reminders';

/**
 * Hidden test tools. Only `require`d behind `__DEV__` (see the Lot screen), so release builds
 * don't include this file. Open it by long-pressing the gate for a second and a half.
 */
export function showTestTools(refresh: () => void): void {
  const active = isTestWindowActive();
  Alert.alert('Test tools', 'Only available in development builds.', [
    active
      ? {
          text: 'Close the gate',
          onPress: () => {
            setTestWindow(null);
            refresh();
          },
        }
      : {
          text: 'Open the gate now (15 min)',
          onPress: () => {
            setTestWindow(15);
            refresh();
          },
        },
    {
      text: 'Send the reminder in 5 seconds',
      onPress: async () => {
        const sent = await sendTestReminder(5).catch(() => false);
        Alert.alert(
          sent ? 'Reminder on its way' : "Notifications aren't allowed",
          sent
            ? 'Switch to another app or lock your phone to see it appear.'
            : 'Allow notifications for Expo Go in iPhone Settings, then try again.',
        );
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
