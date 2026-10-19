import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
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
import { Gate } from '@/components/lot/gate';
import { ParkingSpot, SpotCar } from '@/components/lot/parking-spot';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import {
  type CarKind,
  getSettings,
  isWindowOpen,
  listWorries,
  markReviewed,
  MAX_STEP_LENGTH,
  nextWindowOpen,
  type OpenWorry,
  type ReviewDecision,
  type WindowSettings,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';
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
      planned: number;
      kept: number;
      settings: WindowSettings;
    }
  | { kind: 'done'; released: number; planned: number; kept: number; windowClosed: boolean };

type Choice = 'let_go' | 'small_step' | 'not_now';

const LEAVE_MS = 450;
const SPOT_WIDTH = 132;

/** The car being visited. "Let it go" drives it out of the lot; the other choices fade it back. */
function VisitedCar({ kind, leaving }: { kind: CarKind; leaving: 'drive' | 'fade' | null }) {
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
    transform: [{ translateY: leaving === 'drive' ? -90 * progress.value : 0 }],
  }));

  return (
    <Animated.View style={style}>
      <SpotCar kind={kind} spotWidth={SPOT_WIDTH} lit />
    </Animated.View>
  );
}

/**
 * Visiting hours: the gate is open and the cars can be visited one at a time. The text only ever
 * lives in this screen's state while the visit runs, and is dropped when it ends.
 *
 * For each worry the user picks:
 *  - "Let it go": the car drives out. Saved as reviewed, with the date.
 *  - "Plan one small step": they type a short next step. Saved as reviewed, with the step and date.
 *  - "Not now": nothing is saved. The worry stays parked and locked until the next window.
 * Either saved choice still brings a "Did this actually happen?" check-in a week after parking.
 */
export default function ReviewScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<'drive' | 'fade' | null>(null);
  const [stepping, setStepping] = useState(false);
  const [step, setStep] = useState('');
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
            : { kind: 'reviewing', queue, index: 0, released: 0, planned: 0, kept: 0, settings };
      }
      if (active) setPhase(next);
    })();
    return () => {
      active = false;
    };
  }, [db]);

  async function decide(choice: Choice) {
    if (phase.kind !== 'reviewing' || busy) return;
    if (choice === 'small_step' && step.trim().length === 0) return;
    const { queue, index, settings } = phase;
    const remainingAfter = queue.length - index - 1;
    setBusy(true);
    try {
      let { released, planned, kept } = phase;
      if (choice === 'not_now') {
        kept += 1;
      } else {
        const decision: ReviewDecision =
          choice === 'let_go' ? { choice: 'let_go' } : { choice: 'small_step', step };
        const ok = await markReviewed(db, queue[index].id, settings, new Date(), decision);
        if (!ok) {
          // The gate closed while this worry was on screen: it stays parked.
          setPhase({
            kind: 'done',
            released,
            planned,
            kept: kept + 1 + remainingAfter,
            windowClosed: true,
          });
          if (released + planned > 0) void syncFollowUpReminders(db);
          return;
        }
        if (choice === 'let_go') released += 1;
        else planned += 1;
      }

      // Let the car leave before the next one arrives (skipped with Reduce Motion).
      setLeaving(choice === 'let_go' ? 'drive' : 'fade');
      if (!reducedMotion) await new Promise((resolve) => setTimeout(resolve, LEAVE_MS));
      setLeaving(null);
      setStepping(false);
      setStep('');

      if (remainingAfter === 0) {
        setPhase({ kind: 'done', released, planned, kept, windowClosed: false });
        if (released + planned > 0) void syncFollowUpReminders(db);
      } else if (!isWindowOpen(new Date(), settings)) {
        setPhase({
          kind: 'done',
          released,
          planned,
          kept: kept + remainingAfter,
          windowClosed: true,
        });
        if (released + planned > 0) void syncFollowUpReminders(db);
      } else {
        setPhase({ kind: 'reviewing', queue, index: index + 1, released, planned, kept, settings });
      }
    } catch {
      setLeaving(null);
      Alert.alert("Couldn't save that", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const summary =
    phase.kind === 'done'
      ? [
          phase.released > 0 && `${phase.released} let go`,
          phase.planned > 0 && `${phase.planned} with a small step planned`,
          phase.kept > 0 && `${phase.kept} still parked`,
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

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
              width={SPOT_WIDTH}
              selected
              slot={
                <VisitedCar
                  key={phase.queue[phase.index].id}
                  kind={phase.queue[phase.index].car}
                  leaving={leaving}
                />
              }
            />
          </View>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText style={styles.worryText}>{phase.queue[phase.index].text}</ThemedText>
          </ThemedView>

          {stepping ? (
            <>
              <ThemedText type="headline" accessibilityRole="header">
                One small step
              </ThemedText>
              <TextInput
                value={step}
                onChangeText={setStep}
                multiline
                autoFocus
                maxLength={MAX_STEP_LENGTH}
                placeholder="What's one small thing you could do?"
                placeholderTextColor={theme.textSecondary}
                keyboardAppearance="dark"
                accessibilityLabel="Your small step"
                textAlignVertical="top"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
              <ThemedText type="caption" themeColor="textSecondary">
                {step.length} / {MAX_STEP_LENGTH}
              </ThemedText>
              <Button
                label="Save step"
                disabled={step.trim().length === 0}
                onPress={() => decide('small_step')}
                accessibilityHint="Saves your step. You'll be asked about this worry again a week after you parked it."
              />
              <Button
                label="Back"
                variant="secondary"
                onPress={() => {
                  setStepping(false);
                  setStep('');
                }}
              />
            </>
          ) : (
            <>
              <Button
                label="Let it go"
                onPress={() => decide('let_go')}
                accessibilityHint="The car drives out of the lot. You'll be asked about this worry again a week after you parked it."
              />
              <Button
                label="Plan one small step"
                variant="secondary"
                onPress={() => setStepping(true)}
                accessibilityHint="Write a short next step for this worry"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Not now"
                accessibilityHint="Leaves this car parked and locked until your next worry window"
                hitSlop={8}
                onPress={() => decide('not_now')}
                style={styles.notNow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.notNowText}>
                  Not now
                </ThemedText>
              </Pressable>
            </>
          )}
        </>
      )}

      {phase.kind === 'done' && (
        <>
          <ThemedText>
            {phase.windowClosed
              ? 'The gate has closed. Anything left stays parked until next time.'
              : "That's everyone for today."}
          </ThemedText>
          {summary.length > 0 && <ThemedText themeColor="textSecondary">{summary}</ThemedText>}
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
  input: {
    minHeight: 96,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 17,
    lineHeight: 25,
  },
  notNow: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  notNowText: { textDecorationLine: 'underline' },
});
