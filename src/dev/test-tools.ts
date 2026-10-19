import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { addBox, addTokens, getFinishedWindowCount, isTestWindowActive, setTestWindow } from '@/data';
import { sendTestReminder } from '@/notifications/reminders';

/**
 * Hidden test tools. Only `require`d behind `__DEV__` (see the Lot screen), so release builds
 * don't include this file. Open it by long-pressing the gate for a second and a half.
 *
 * They exist so the gate, the reminder, and the reward system can be tried without waiting days.
 * Nothing here is reachable in a real build, and boxes still can't be bought: these just add
 * test rewards to a development database.
 */
export function showTestTools(db: SQLiteDatabase, refresh: () => void): void {
  const active = isTestWindowActive();
  const stamp = Date.now();

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
    {
      text: 'Add 200 tokens',
      onPress: async () => {
        await addTokens(db, 200, 'dev', null);
        refresh();
      },
    },
    {
      text: 'Add one of each box',
      onPress: async () => {
        await addBox(db, 'glovebox', `dev:${stamp}:glovebox`);
        await addBox(db, 'toolbox', `dev:${stamp}:toolbox`);
        await addBox(db, 'golden', `dev:${stamp}:golden`);
        Alert.alert('Boxes added', 'Look in the Garage tab.');
        refresh();
      },
    },
    {
      text: 'Count 5 more finished windows',
      onPress: async () => {
        const have = await getFinishedWindowCount(db);
        for (let i = 1; i <= 5; i++) {
          await db.runAsync(
            `INSERT OR IGNORE INTO finished_windows (dayKey, weekKey, finishedAt) VALUES ($key, 'dev', $at)`,
            { $key: `dev-${stamp}-${have + i}`, $at: new Date().toISOString() },
          );
        }
        Alert.alert('Done', `Finished windows: ${have + 5}. Matte unlocks at 5, Metallic at 15, Pearlescent at 30, Chrome at 50.`);
        refresh();
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
