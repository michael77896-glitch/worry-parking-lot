import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Car } from '@/components/lot/car';
import { Gate } from '@/components/lot/gate';
import { ParkingSpot } from '@/components/lot/parking-spot';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CarColors, Radius, Spacing } from '@/constants/theme';
import {
  getSettings,
  isWindowOpen,
  listWorries,
  markReviewed,
  nextWindowOpen,
  type OpenWorry,
  type WindowSettings,
} from '@/data';
import { syncFollowUpReminders } from '@/notifications/followups';
import { formatWhen } from '@/utils/format';

type Phase =
  | { kind: 'loading' }
  | { kind: 'closed'; nextOpen: Date }
  | { kind: 'empty' }
  | {
      kind: 'reviewing';
      queue: OpenWorry[];
      index: number;
      released: number;
      kept: number;
      settings: WindowSettings;
    }
  | { kind: 'done'; released: number; kept: number; windowClosed: boolean };

const LEAVE_MS = 450;

/** The car being visited. When the worry is released it drives off; when kept it fades back. */
function VisitedCar({ color, leaving }: { color: string; leaving: 'release' | 'keep' | null }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (leaving) {
      progress.value = withTiming(1, {
        duration: LEAVE_MS,
        easing: Easing.in(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    } else {
      progress.value = 0;
    }
  }, [leaving, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: leaving === 'release' ? -90 * progress.value : 0 }],
  }));

  return (
    <Animated.View style={style}>
      <Car color={color} width={72} lit />
    </Animated.View>
  );
}

/**
 * Visiting hours: the gate is open and the cars can be visited one at a time. The text only ever
 * lives in this screen's state while the visit runs, and is dropped when it ends.
 * "Release" marks a worry reviewed (its follow-up still comes a week after it was parked).
 * "Keep parked" leaves it untouched, so it stays locked and comes back at the next window.
 */
export default function ReviewScreen() {
  const db = useSQLiteContext();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<'release' | 'keep' | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const now = new Date();
      const settings = await getSettings(db);
      let next: Phase;
      if (!isWindowOpen(now, settings)) {
        next = { kind: 'closed', nextOpen: nextWindowOpen(now, settings) };
      } else {
        const worries = await listWorries(db, settings, now);
        const queue = worries
          .filter((w): w is OpenWorry => !w.locked && w.reviewedAt === null)
          .reverse(); // oldest first
        next =
          queue.length === 0
            ? { kind: 'empty' }
            : { kind: 'reviewing', queue, index: 0, released: 0, kept: 0, settings };
      }
      if (active) setPhase(next);
    })();
    return () => {
      active = false;
    };
  }, [db]);

  async function answer(release: boolean) {
    if (phase.kind !== 'reviewing' || busy) return;
    const { queue, index, settings } = phase;
    const remainingAfter = queue.length - index - 1;
    setBusy(true);
    try {
      let { released, kept } = phase;
      if (release) {
        const ok = await markReviewed(db, queue[index].id, settings, new Date());
        if (!ok) {
          // The window closed while this worry was on screen: it stays parked.
          setPhase({ kind: 'done', released, kept: kept + 1 + remainingAfter, windowClosed: true });
          if (released > 0) void syncFollowUpReminders(db);
          return;
        }
        released += 1;
      } else {
        kept += 1;
      }

      // Let the car leave before the next one arrives (skipped with Reduce Motion).
      setLeaving(release ? 'release' : 'keep');
      if (!reducedMotion) await new Promise((resolve) => setTimeout(resolve, LEAVE_MS));
      setLeaving(null);

      if (remainingAfter === 0) {
        setPhase({ kind: 'done', released, kept, windowClosed: false });
        if (released > 0) void syncFollowUpReminders(db);
      } else if (!isWindowOpen(new Date(), settings)) {
        setPhase({ kind: 'done', released, kept: kept + remainingAfter, windowClosed: true });
        if (released > 0) void syncFollowUpReminders(db);
      } else {
        setPhase({ kind: 'reviewing', queue, index: index + 1, released, kept, settings });
      }
    } catch {
      setLeaving(null);
      Alert.alert("Couldn't save that", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackLink />
      <ThemedText type="subtitle">Visiting hours</ThemedText>

      {(phase.kind === 'closed' || phase.kind === 'done' || phase.kind === 'empty') && (
        <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)} style={styles.stretch}>
          {gridWidth > 0 && (
            <Gate
              open={phase.kind === 'empty' || (phase.kind === 'done' && !phase.windowClosed)}
              width={gridWidth}
            />
          )}
        </View>
      )}

      {phase.kind === 'closed' && (
        <ThemedText>
          The gate is closed right now. It opens {formatWhen(phase.nextOpen)}. Until then, your cars
          stay parked and locked.
        </ThemedText>
      )}

      {phase.kind === 'empty' && (
        <ThemedText>The gate is open, but no cars are waiting for a visit.</ThemedText>
      )}

      {phase.kind === 'reviewing' && (
        <>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            Car {phase.index + 1} of {phase.queue.length}
          </ThemedText>
          <View style={styles.spot}>
            <ParkingSpot
              number={phase.index + 1}
              width={120}
              selected
              slot={
                <VisitedCar
                  key={phase.queue[phase.index].id}
                  color={CarColors[phase.queue[phase.index].id % CarColors.length]}
                  leaving={leaving}
                />
              }
            />
          </View>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText style={styles.worryText}>{phase.queue[phase.index].text}</ThemedText>
          </ThemedView>
          <Button
            label="Release"
            onPress={() => answer(true)}
            accessibilityHint="Marks this worry as reviewed. You'll be asked about it again a week after you parked it."
          />
          <Button
            label="Keep parked"
            variant="secondary"
            onPress={() => answer(false)}
            accessibilityHint="Leaves this worry locked until your next worry window"
          />
        </>
      )}

      {phase.kind === 'done' && (
        <>
          <ThemedText>
            {phase.windowClosed
              ? 'The gate has closed. Anything left stays parked until next time.'
              : "That's everyone for today."}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            {phase.released} released. {phase.kept} still parked.
          </ThemedText>
          <Button label="Done" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: 'stretch' },
  spot: { alignItems: 'center' },
  card: { borderRadius: Radius.card, padding: Spacing.four },
  worryText: { fontSize: 20, lineHeight: 30 },
});
