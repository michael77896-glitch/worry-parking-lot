import { useSQLiteContext } from 'expo-sqlite';
import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Gate } from '@/components/lot/gate';
import { ParkingSpot } from '@/components/lot/parking-spot';
import { ParkingTicket } from '@/components/lot/ticket';
import { useOnboarding } from '@/components/onboarding-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
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
    title: 'Visit when the gate opens',
    body: 'Once a day, the gate opens for a short worry window you choose. You can visit your cars, read what you parked, and decide what to do with each one.',
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
  const [width, setWidth] = useState(0);

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

  // A small picture for each how-it-works card.
  const pictures: ReactNode[] = [
    <ParkingSpot key="spot" number={1} width={110} car={{ kind: 'beetle' }} />,
    width > 0 ? <Gate key="gate" open width={width} /> : null,
    <View key="ticket" style={styles.stretch}>
      <ParkingTicket label="A week later" value="Did it happen?" code="Space 1" />
    </View>,
  ];

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {page + 1} of {PAGE_COUNT}
      </ThemedText>

      {page < ABOUT_PAGE && (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.page}>
          <View style={styles.picture}>{pictures[page]}</View>
          <ThemedText type="subtitle">{HOW_IT_WORKS[page].title}</ThemedText>
          <ThemedText style={styles.body}>{HOW_IT_WORKS[page].body}</ThemedText>
        </View>
      )}

      {page === ABOUT_PAGE && (
        <>
          <ThemedText type="subtitle">Before you start</ThemedText>
          <ThemedText style={styles.body}>
            Everything you write stays on this phone. Nothing is sent anywhere.
          </ThemedText>
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
            This is when the gate opens each day, so you can visit your cars. You can change it
            later in Settings, where you can also turn on a daily reminder.
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
      {page > 0 && <Button label="Back" variant="secondary" onPress={() => setPage(page - 1)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.three },
  picture: { alignItems: 'center', minHeight: 170, justifyContent: 'center' },
  stretch: { alignSelf: 'stretch', width: '100%' },
  body: { fontSize: 19, lineHeight: 28 },
});
