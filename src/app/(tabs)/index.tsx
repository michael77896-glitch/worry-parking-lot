import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getSettings, listWorries, nextWindowOpen } from '@/data';
import { formatWhen } from '@/utils/format';

type Summary = { parked: number; nextOpen: Date };

/** Interim home screen. The real Parking Lot list arrives in build step 3. */
export default function ParkingLotScreen() {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<Summary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const now = new Date();
        const settings = await getSettings(db);
        const worries = await listWorries(db, settings, now);
        if (active) setSummary({ parked: worries.length, nextOpen: nextWindowOpen(now, settings) });
      })();
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Parking Lot</ThemedText>
      {summary && (
        <>
          <ThemedText>
            {summary.parked === 0
              ? "Nothing is parked right now. When something's on your mind, you can park it here and come back to it later."
              : `${summary.parked} parked.`}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Your next worry window opens {formatWhen(summary.nextOpen)}.
          </ThemedText>
        </>
      )}
      <Button label="Park a worry" onPress={() => router.push('/park')} />
    </Screen>
  );
}
