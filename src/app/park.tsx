import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getSettings, MAX_WORRY_LENGTH, nextWindowOpen, parkWorry } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { formatWhen } from '@/utils/format';

/** Show the character count only when the user is getting close to the limit. */
const COUNTER_THRESHOLD = MAX_WORRY_LENGTH - 200;

export default function ParkWorryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [unlocksAt, setUnlocksAt] = useState<Date | null>(null);

  const canPark = text.trim().length > 0 && !saving;

  async function park() {
    if (!canPark) return;
    setSaving(true);
    try {
      const now = new Date();
      const settings = await getSettings(db);
      await parkWorry(db, text, settings, now);
      // The text is cleared as soon as it is saved and is never shown again until the window.
      setText('');
      setUnlocksAt(nextWindowOpen(now, settings));
    } catch {
      Alert.alert("Couldn't park that", 'Your worry was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      hitSlop={8}
      style={styles.back}>
      <ThemedText type="default" themeColor="accent">
        ‹ Back
      </ThemedText>
    </Pressable>
  );

  if (unlocksAt) {
    return (
      <Screen>
        {back}
        <ThemedText type="subtitle">Parked.</ThemedText>
        <ThemedText>
          It&apos;s locked until your worry window opens, {formatWhen(unlocksAt)}. You
          don&apos;t have to hold onto it until then.
        </ThemedText>
        <Button label="Park another" variant="secondary" onPress={() => setUnlocksAt(null)} />
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {back}
      <ThemedText type="subtitle">Park a worry</ThemedText>
      <ThemedText themeColor="textSecondary">
        Write it down here. It stays locked until your worry window, so you can set it down for now.
      </ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        maxLength={MAX_WORRY_LENGTH}
        placeholder="What's on your mind?"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Your worry"
        textAlignVertical="top"
        style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
      {text.length >= COUNTER_THRESHOLD && (
        <ThemedText type="small" themeColor="textSecondary">
          {text.length} / {MAX_WORRY_LENGTH}
        </ThemedText>
      )}
      <Button
        label={saving ? 'Parking…' : 'Park it'}
        onPress={park}
        accessibilityHint="Saves this worry on your phone and locks it until your worry window"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  input: {
    minHeight: 160,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 24,
  },
});
