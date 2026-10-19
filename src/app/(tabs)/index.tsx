import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DeleteLink } from '@/components/delete-link';
import { Gate } from '@/components/lot/gate';
import { ParkingSpot } from '@/components/lot/parking-spot';
import { ParkingTicket } from '@/components/lot/ticket';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { CarColors, Spacing } from '@/constants/theme';
import {
  countDueFollowUps,
  currentWindow,
  deleteWorry,
  getSettings,
  isTestWindowActive,
  listParked,
  nextWindowOpen,
  readableAt,
  type ParkedWorry,
  type WindowSettings,
} from '@/data';
import { syncFollowUpReminders } from '@/notifications/followups';
import { formatDateTime, formatTime, formatWhen } from '@/utils/format';

// Hidden test tools exist only in development builds. The `require` sits behind `__DEV__` so
// release builds don't bundle the module at all.
const showTestTools: ((refresh: () => void) => void) | undefined = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/test-tools').showTestTools
  : undefined;

const COLUMNS = 3;
const GAP = 12;
const MIN_ROWS = 2;

type Snapshot = {
  now: Date;
  settings: WindowSettings;
  /** Oldest first, so the first car parked is in space 1. */
  parked: ParkedWorry[];
  dueFollowUps: number;
};

export default function LotScreen() {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const refresh = useCallback(async () => {
    const now = new Date();
    const settings = await getSettings(db);
    const parked = (await listParked(db)).reverse();
    const dueFollowUps = await countDueFollowUps(db, now);
    setSnapshot({ now, settings, parked, dueFollowUps });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Watch the gate: refresh the moment the window opens or closes, and when the app returns.
  useEffect(() => {
    if (!snapshot) return;
    const { now, settings } = snapshot;
    const window = currentWindow(now, settings);
    const nextChange = window ? window.closesAt : nextWindowOpen(now, settings);
    const delay = Math.min(nextChange.getTime() - Date.now() + 500, 2_000_000_000);
    const timer = setTimeout(() => void refresh(), Math.max(delay, 1000));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [snapshot, refresh]);

  async function remove(id: number) {
    await deleteWorry(db, id);
    setSelectedId(null);
    await refresh();
    void syncFollowUpReminders(db);
  }

  if (!snapshot) {
    return (
      <Screen>
        <ThemedText type="subtitle">The Lot</ThemedText>
      </Screen>
    );
  }

  const { now, settings, parked, dueFollowUps } = snapshot;
  const window = currentWindow(now, settings);
  const isOpen = window !== null;
  const opensFor = (w: ParkedWorry) => readableAt(new Date(w.unlocksAt), now, settings);
  const isReady = (w: ParkedWorry) => opensFor(w) <= now;
  const readyCount = parked.filter(isReady).length;

  const selected = parked.find((w) => w.id === selectedId) ?? parked[0];
  const selectedNumber = selected ? parked.indexOf(selected) + 1 : 0;

  const spotWidth = gridWidth > 0 ? (gridWidth - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const rows = Math.max(MIN_ROWS, Math.ceil(parked.length / COLUMNS));

  return (
    <Screen>
      <ThemedText type="subtitle">The Lot</ThemedText>

      <View
        onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
        style={styles.gateWrap}>
        {gridWidth > 0 &&
          (showTestTools ? (
            <Pressable
              accessible={false}
              delayLongPress={1500}
              onLongPress={() => showTestTools(() => void refresh())}>
              <Gate open={isOpen} width={gridWidth} />
            </Pressable>
          ) : (
            <Gate open={isOpen} width={gridWidth} />
          ))}
      </View>
      <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
        {window
          ? `The gate is open until ${formatTime(window.closesAt)}.`
          : `The gate opens ${formatWhen(nextWindowOpen(now, settings))}.`}
      </ThemedText>
      {isTestWindowActive(now) && (
        <ThemedText type="caption" themeColor="textSecondary">
          Test mode: the gate was opened by hand.
        </ThemedText>
      )}

      {readyCount > 0 && (
        <Button
          label={readyCount === 1 ? 'Visit your car' : 'Visit your cars'}
          onPress={() => router.push('/review')}
          accessibilityHint="Read what you parked and decide what to do with each worry"
        />
      )}
      {dueFollowUps > 0 && (
        <Button
          label={dueFollowUps === 1 ? 'Look back at 1 worry' : `Look back at ${dueFollowUps} worries`}
          variant={readyCount > 0 ? 'secondary' : 'primary'}
          onPress={() => router.push('/followup')}
          accessibilityHint="Answer whether worries from a week ago actually happened"
        />
      )}
      <Button
        label="Park a worry"
        variant={readyCount > 0 || dueFollowUps > 0 ? 'secondary' : 'primary'}
        onPress={() => router.push('/park')}
      />

      {parked.length === 0 && (
        <ThemedText>
          The lot is empty. When something&apos;s on your mind, park it here and come back when the
          gate opens.
        </ThemedText>
      )}

      {spotWidth > 0 && (
        <View style={styles.grid}>
          {Array.from({ length: rows }).map((_, row) => (
            <View key={row} style={styles.row}>
              {Array.from({ length: COLUMNS }).map((__, col) => {
                const index = row * COLUMNS + col;
                const worry = parked[index];
                if (!worry) {
                  return <ParkingSpot key={`empty-${index}`} number={index + 1} width={spotWidth} />;
                }

                const ready = isReady(worry);
                const parkedAt = formatDateTime(new Date(worry.parkedAt));
                const status = ready
                  ? 'Open to visit now.'
                  : `Locked until ${formatWhen(opensFor(worry))}.`;
                return (
                  <ParkingSpot
                    key={`car-${worry.id}`}
                    number={index + 1}
                    width={spotWidth}
                    car={{ color: CarColors[worry.id % CarColors.length], lit: ready }}
                    enterDelay={index * 90}
                    selected={worry.id === selected?.id}
                    onPress={() => setSelectedId(worry.id)}
                    accessibilityLabel={`Space ${index + 1}. Worry parked ${parkedAt}. ${status}`}
                    accessibilityHint="Shows its parking ticket"
                  />
                );
              })}
            </View>
          ))}
        </View>
      )}

      {selected && (
        <View style={styles.ticketWrap}>
          <ParkingTicket
            code={`Space ${selectedNumber}`}
            label={isReady(selected) ? 'The gate is open' : 'Gate opens for you'}
            value={isReady(selected) ? 'Open now' : formatWhen(opensFor(selected))}
            note={window && isReady(selected) ? `Until ${formatTime(window.closesAt)}` : undefined}
            stub={[{ label: 'Parked', value: formatDateTime(new Date(selected.parkedAt)) }]}
          />
          <DeleteLink onConfirmed={() => remove(selected.id)} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gateWrap: { alignSelf: 'stretch' },
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  ticketWrap: { gap: Spacing.two, marginTop: Spacing.two },
});
