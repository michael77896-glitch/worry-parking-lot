import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { useOnboarding } from '@/components/onboarding-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WindowPicker } from '@/components/window-picker';
import { DISCLAIMER } from '@/constants/copy';
import { Spacing } from '@/constants/theme';
import { DEFAULT_WINDOW, saveSettings } from '@/data';

const HOW_IT_WORKS = [
  {
    title: 'Park it',
    body: "When a worry is on your mind, write it down and park it. It's locked right away, so you can set it down for now.",
  },
  {
    title: 'Visit it at your worry window',
    body: 'Once a day, in a short window you choose, you can read what you parked. You decide whether to release each worry or keep it parked.',
  },
  {
    title: 'Look back',
    body: "A week after you parked a worry, you'll be asked whether it actually happened. Over time you build a plain record of how things turned out.",
  },
];

// Pages: the three how-it-works cards, then "about", then window setup.
const ABOUT_PAGE = HOW_IT_WORKS.length;
const WINDOW_PAGE = HOW_IT_WORKS.length + 1;
const PAGE_COUNT = HOW_IT_WORKS.length + 2;

/**
 * First-run walkthrough. The "Crisis help" button stays visible on every page, and nothing
 * here blocks reaching the crisis screen.
 */
export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const { complete } = useOnboarding();
  const [page, setPage] = useState(0);
  const [startMinutes, setStartMinutes] = useState(DEFAULT_WINDOW.startMinutes);
  const [lengthMinutes, setLengthMinutes] = useState(DEFAULT_WINDOW.lengthMinutes);
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (saving) return;
    setSaving(true);
    try {
      await saveSettings(db, { startMinutes, lengthMinutes });
      await complete();
    } catch {
      Alert.alert("Couldn't finish setup", 'Please try again.');
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {page + 1} of {PAGE_COUNT}
      </ThemedText>

      {page < ABOUT_PAGE && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">{HOW_IT_WORKS[page].title}</ThemedText>
          <ThemedText style={styles.cardBody}>{HOW_IT_WORKS[page].body}</ThemedText>
        </ThemedView>
      )}

      {page === ABOUT_PAGE && (
        <>
          <ThemedText type="subtitle">Before you start</ThemedText>
          <ThemedText>Everything you write stays on this phone. Nothing is sent anywhere.</ThemedText>
          <ThemedText themeColor="textSecondary">{DISCLAIMER}</ThemedText>
          <ThemedText themeColor="textSecondary">
            If you are in crisis, the Crisis help button at the top of every screen opens phone
            numbers you can call or text right now.
          </ThemedText>
        </>
      )}

      {page === WINDOW_PAGE && (
        <>
          <ThemedText type="subtitle">Choose your worry window</ThemedText>
          <ThemedText themeColor="textSecondary">
            This is the short time each day when you can read what you&apos;ve parked. You can
            change it later in Settings, where you can also turn on a daily reminder.
          </ThemedText>
          <WindowPicker
            startMinutes={startMinutes}
            lengthMinutes={lengthMinutes}
            onStartChange={setStartMinutes}
            onLengthChange={setLengthMinutes}
          />
        </>
      )}

      {page < WINDOW_PAGE ? (
        <Button
          label={page === ABOUT_PAGE ? 'I understand' : 'Next'}
          onPress={() => setPage(page + 1)}
        />
      ) : (
        <Button label={saving ? 'Saving…' : 'Start'} onPress={finish} />
      )}
      {page > 0 && (
        <Button label="Back" variant="secondary" onPress={() => setPage(page - 1)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  cardBody: { fontSize: 18, lineHeight: 28 },
});
