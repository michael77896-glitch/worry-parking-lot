import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Car } from '@/components/lot/car';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CarColors, Radius, Spacing } from '@/constants/theme';
import { listDueFollowUps, recordOutcome, type FollowUp, type Outcome } from '@/data';
import { syncFollowUpReminders } from '@/notifications/followups';
import { formatDateTime } from '@/utils/format';

type Phase =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'asking'; queue: FollowUp[]; index: number; answered: number }
  | { kind: 'done'; answered: number; skipped: number };

const CHOICES: { outcome: Outcome; label: string }[] = [
  { outcome: 'happened', label: 'Yes, it happened' },
  { outcome: 'partly', label: 'Partly' },
  { outcome: 'did_not_happen', label: "No, it didn't happen" },
];

/**
 * A short look back at worries the user parked and reviewed at least a week ago.
 * Answers are a plain record. "Not now" leaves a check-in for another day.
 */
export default function FollowUpScreen() {
  const db = useSQLiteContext();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const queue = await listDueFollowUps(db);
      if (active) {
        setPhase(queue.length === 0 ? { kind: 'empty' } : { kind: 'asking', queue, index: 0, answered: 0 });
      }
    })();
    return () => {
      active = false;
    };
  }, [db]);

  async function advance(outcome: Outcome | null) {
    if (phase.kind !== 'asking' || busy) return;
    const { queue, index } = phase;
    setBusy(true);
    try {
      let answered = phase.answered;
      let skippedNow = skipped;
      if (outcome === null) {
        skippedNow += 1;
        setSkipped(skippedNow);
      } else if (await recordOutcome(db, queue[index].id, outcome)) {
        answered += 1;
      }

      if (index + 1 >= queue.length) {
        setPhase({ kind: 'done', answered, skipped: skippedNow });
        if (answered > 0) void syncFollowUpReminders(db);
      } else {
        setPhase({ kind: 'asking', queue, index: index + 1, answered });
      }
    } catch {
      Alert.alert("Couldn't save that", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackLink />
      <ThemedText type="subtitle">Looking back</ThemedText>

      {phase.kind === 'empty' && (
        <ThemedText>No check-ins are waiting. Worries show up here a week after you park them.</ThemedText>
      )}

      {phase.kind === 'asking' && (
        <>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {phase.index + 1} of {phase.queue.length}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.carRow}>
              <Car color={CarColors[phase.queue[phase.index].id % CarColors.length]} width={34} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.parkedOn}>
                You parked this on {formatDateTime(new Date(phase.queue[phase.index].parkedAt))}.
              </ThemedText>
            </View>
            <ThemedText style={styles.worryText}>{phase.queue[phase.index].text}</ThemedText>
          </ThemedView>
          <ThemedText type="headline" accessibilityRole="header">
            Did this actually happen?
          </ThemedText>
          {CHOICES.map((c) => (
            <Button key={c.outcome} label={c.label} onPress={() => advance(c.outcome)} />
          ))}
          <Button
            label="Not now"
            variant="secondary"
            onPress={() => advance(null)}
            accessibilityHint="Skips this one. It will be here next time."
          />
        </>
      )}

      {phase.kind === 'done' && (
        <>
          <ThemedText>
            {phase.answered === 0 ? 'No answers recorded this time.' : 'Thanks, that’s recorded.'}
          </ThemedText>
          {phase.skipped > 0 && (
            <ThemedText themeColor="textSecondary">{phase.skipped} left for another day.</ThemedText>
          )}
          <Button label="Done" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  parkedOn: { flex: 1 },
  worryText: { fontSize: 20, lineHeight: 30 },
});
