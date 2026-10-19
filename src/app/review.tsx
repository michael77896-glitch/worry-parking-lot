import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  getSettings,
  isWindowOpen,
  listWorries,
  markReviewed,
  nextWindowOpen,
  type OpenWorry,
  type WindowSettings,
} from '@/data';
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

/**
 * Walks through the worries that are readable right now, one at a time. The text only
 * ever lives in this screen's state while the review runs, and is dropped when it ends.
 * "Release" marks a worry reviewed (its follow-up still comes a week after it was parked).
 * "Keep parked" leaves it untouched, so it stays locked and comes back at the next window.
 */
export default function ReviewScreen() {
  const db = useSQLiteContext();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

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
          return;
        }
        released += 1;
      } else {
        kept += 1;
      }

      if (remainingAfter === 0) {
        setPhase({ kind: 'done', released, kept, windowClosed: false });
      } else if (!isWindowOpen(new Date(), settings)) {
        setPhase({ kind: 'done', released, kept: kept + remainingAfter, windowClosed: true });
      } else {
        setPhase({ kind: 'reviewing', queue, index: index + 1, released, kept, settings });
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
      <ThemedText type="subtitle">Worry window</ThemedText>

      {phase.kind === 'closed' && (
        <ThemedText>
          Your worry window is closed right now. It opens {formatWhen(phase.nextOpen)}. Until then,
          your parked worries stay locked.
        </ThemedText>
      )}

      {phase.kind === 'empty' && (
        <ThemedText>Nothing is waiting for review right now.</ThemedText>
      )}

      {phase.kind === 'reviewing' && (
        <>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {phase.index + 1} of {phase.queue.length}
          </ThemedText>
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
              ? 'Your worry window has closed. Anything left stays parked until next time.'
              : "That's all for today."}
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
  card: { borderRadius: Spacing.four, padding: Spacing.four },
  worryText: { fontSize: 20, lineHeight: 30 },
});
