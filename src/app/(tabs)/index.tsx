import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  currentWindow,
  getSettings,
  listParked,
  nextWindowOpen,
  readableAt,
  type ParkedWorry,
  type WindowSettings,
} from '@/data';
import { formatDateTime, formatTime, formatWhen } from '@/utils/format';

type Snapshot = { now: Date; settings: WindowSettings; parked: ParkedWorry[] };

/** One parked worry. Deliberately shows when it was parked and when it opens, never what it says. */
function ParkedRow({ worry, snapshot }: { worry: ParkedWorry; snapshot: Snapshot }) {
  const { now, settings } = snapshot;
  const parkedAt = formatDateTime(new Date(worry.parkedAt));
  const opensAt = readableAt(new Date(worry.unlocksAt), now, settings);
  const readyNow = opensAt <= now;
  const status = readyNow
    ? `Your worry window is open until ${formatTime(currentWindow(now, settings)!.closesAt)}.`
    : `Locked until ${formatWhen(opensAt)}.`;

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.row}
      accessible
      accessibilityLabel={`Worry parked ${parkedAt}. ${status}`}>
      <ThemedText type="smallBold">Parked {parkedAt}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {status}
      </ThemedText>
    </ThemedView>
  );
}

export default function ParkingLotScreen() {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const now = new Date();
        const settings = await getSettings(db);
        const parked = await listParked(db);
        if (active) setSnapshot({ now, settings, parked });
      })();
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Parking Lot</ThemedText>
      {snapshot && (
        <>
          <ThemedText themeColor="textSecondary">
            {currentWindow(snapshot.now, snapshot.settings)
              ? 'Your worry window is open now.'
              : `Your next worry window opens ${formatWhen(nextWindowOpen(snapshot.now, snapshot.settings))}.`}
          </ThemedText>

          <Button label="Park a worry" onPress={() => router.push('/park')} />

          {snapshot.parked.length === 0 ? (
            <ThemedText>
              Nothing is parked right now. When something&apos;s on your mind, you can park it here
              and come back to it later.
            </ThemedText>
          ) : (
            <>
              <ThemedText type="smallBold" accessibilityRole="header">
                {snapshot.parked.length === 1
                  ? '1 worry parked'
                  : `${snapshot.parked.length} worries parked`}
              </ThemedText>
              {snapshot.parked.map((w) => (
                <ParkedRow key={w.id} worry={w} snapshot={snapshot} />
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
