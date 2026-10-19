import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { CarPicker, type CarChoice } from '@/components/lot/car-picker';
import { ParkingSpot } from '@/components/lot/parking-spot';
import { ParkingTicket } from '@/components/lot/ticket';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import {
  CAR_LABELS,
  getSettings,
  listParked,
  MAX_WORRY_LENGTH,
  nextWindowOpen,
  parkWorry,
  randomCarKind,
  type CarKind,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, formatWhen } from '@/utils/format';

/** Show the character count only when the user is getting close to the limit. */
const COUNTER_THRESHOLD = MAX_WORRY_LENGTH - 200;

type Parked = { id: number; car: CarKind; space: number; parkedAt: Date; unlocksAt: Date };

export default function ParkWorryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [parked, setParked] = useState<Parked | null>(null);
  const [carChoice, setCarChoice] = useState<CarChoice>('random');

  const canPark = text.trim().length > 0 && !saving;

  async function park() {
    if (!canPark) return;
    setSaving(true);
    try {
      const now = new Date();
      const settings = await getSettings(db);
      // "Surprise me" is decided here, so the confirmation can show which car it turned out to be.
      const car = carChoice === 'random' ? randomCarKind() : carChoice;
      const id = await parkWorry(db, text, settings, now, car);
      const space = (await listParked(db)).length;
      // The text is cleared as soon as it is saved and is never shown again until the gate opens.
      setText('');
      setParked({ id, car, space, parkedAt: now, unlocksAt: nextWindowOpen(now, settings) });
    } catch {
      Alert.alert("Couldn't park that", 'Your worry was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (parked) {
    return (
      <Screen>
        <BackLink />
        <ThemedText type="subtitle">Parked.</ThemedText>
        <ThemedText>
          Your {CAR_LABELS[parked.car].toLowerCase()} is in space {parked.space}. The gate opens{' '}
          {formatWhen(parked.unlocksAt)}. You don&apos;t have to hold onto it until then.
        </ThemedText>
        <View style={styles.spot}>
          <ParkingSpot
            number={parked.space}
            width={140}
            car={{ kind: parked.car }}
            enterDelay={150}
            accessibilityLabel={`Your ${CAR_LABELS[parked.car].toLowerCase()} in space ${parked.space}`}
          />
        </View>
        <ParkingTicket
          code={`Space ${parked.space}`}
          label="Gate opens for you"
          value={formatWhen(parked.unlocksAt)}
          stub={[{ label: 'Parked', value: formatDateTime(parked.parkedAt) }]}
        />
        <Button label="Park another" variant="secondary" onPress={() => setParked(null)} />
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink />
      <ThemedText type="subtitle">Park a worry</ThemedText>
      <ThemedText themeColor="textSecondary">
        Write it down and leave it here. The gate stays closed until your worry window, so you can
        set it down for now.
      </ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        maxLength={MAX_WORRY_LENGTH}
        placeholder="What's on your mind?"
        placeholderTextColor={theme.textSecondary}
        keyboardAppearance="dark"
        accessibilityLabel="Your worry"
        textAlignVertical="top"
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text },
        ]}
      />
      {text.length >= COUNTER_THRESHOLD && (
        <ThemedText type="caption" themeColor="textSecondary">
          {text.length} / {MAX_WORRY_LENGTH}
        </ThemedText>
      )}
      <ThemedText type="headline" accessibilityRole="header">
        Pick a car
      </ThemedText>
      <CarPicker value={carChoice} onChange={setCarChoice} />
      <Button
        label={saving ? 'Parking…' : 'Park it'}
        onPress={park}
        accessibilityHint="Saves this worry on your phone and locks it until your worry window"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 168,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 17,
    lineHeight: 25,
  },
  spot: { alignItems: 'center' },
});
