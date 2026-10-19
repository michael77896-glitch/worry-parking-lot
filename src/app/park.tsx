import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { CarPicker } from '@/components/lot/car-picker';
import { ParkingSpot, SpotCar } from '@/components/lot/parking-spot';
import { ParkingTicket } from '@/components/lot/ticket';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getCar, randomUnlockedCar } from '@/constants/car-catalog';
import { Radius, Spacing } from '@/constants/theme';
import { getSettings, listParked, MAX_WORRY_LENGTH, nextWindowOpen, parkWorry } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, formatWhen } from '@/utils/format';

/** Show the character count only when the user is getting close to the limit. */
const COUNTER_THRESHOLD = MAX_WORRY_LENGTH - 200;
const PREVIEW_WIDTH = 136;

type Parked = { id: number; car: string; space: number; parkedAt: Date; unlocksAt: Date };

export default function ParkWorryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [parked, setParked] = useState<Parked | null>(null);
  // A random starter car pulls into the spot. Until the worry is parked, it can be swapped.
  const [carId, setCarId] = useState(() => randomUnlockedCar().id);
  const [swapping, setSwapping] = useState(false);

  const canPark = text.trim().length > 0 && !saving;
  const car = getCar(carId);

  async function park() {
    if (!canPark) return;
    setSaving(true);
    try {
      const now = new Date();
      const settings = await getSettings(db);
      const id = await parkWorry(db, text, settings, now, carId);
      const space = (await listParked(db)).length;
      // The text is cleared as soon as it is saved and is never shown again until the gate opens.
      setText('');
      setSwapping(false);
      setParked({ id, car: carId, space, parkedAt: now, unlocksAt: nextWindowOpen(now, settings) });
    } catch {
      Alert.alert("Couldn't park that", 'Your worry was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (parked) {
    const parkedCar = getCar(parked.car);
    return (
      <Screen>
        <BackLink />
        <ThemedText type="subtitle">Parked.</ThemedText>
        <ThemedText>
          Your {parkedCar.name.toLowerCase()} is in space {parked.space}. The gate opens{' '}
          {formatWhen(parked.unlocksAt)}. You don&apos;t have to hold onto it until then.
        </ThemedText>
        <View style={styles.center}>
          <ParkingSpot
            number={parked.space}
            width={140}
            car={{ id: parked.car }}
            enterDelay={150}
            accessibilityLabel={`Your ${parkedCar.name.toLowerCase()} in space ${parked.space}`}
          />
        </View>
        <ParkingTicket
          code={`Space ${parked.space}`}
          label="Gate opens for you"
          value={formatWhen(parked.unlocksAt)}
          stub={[{ label: 'Parked', value: formatDateTime(parked.parkedAt) }]}
        />
        <Button
          label="Park another"
          variant="secondary"
          onPress={() => {
            setCarId(randomUnlockedCar(parked.car).id);
            setParked(null);
          }}
        />
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

      <View style={styles.preview}>
        <ParkingSpot
          width={PREVIEW_WIDTH}
          selected={swapping}
          onPress={() => setSwapping((open) => !open)}
          accessibilityLabel={`${car.name}, ${car.style}. Tap to swap for a different car.`}
          slot={
            // A new key makes the new car pull in while the old one backs out, in the same spot.
            <Animated.View
              key={carId}
              style={styles.previewCar}
              entering={FadeInDown.duration(600)
                .easing(Easing.out(Easing.cubic))
                .reduceMotion(ReduceMotion.System)}
              exiting={FadeOutDown.duration(250).reduceMotion(ReduceMotion.System)}>
              <SpotCar carId={carId} spotWidth={PREVIEW_WIDTH} />
            </Animated.View>
          }
        />
        <View style={styles.previewText}>
          <ThemedText type="caption" themeColor="textSecondary">
            YOUR CAR
          </ThemedText>
          <ThemedText type="title">{car.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {car.style}
          </ThemedText>
          <Button
            label={swapping ? 'Keep this car' : 'Swap car'}
            variant="secondary"
            onPress={() => setSwapping((open) => !open)}
            accessibilityHint={swapping ? 'Closes the list of cars' : 'Shows other cars you can park as'}
          />
        </View>
      </View>
      {swapping && (
        <CarPicker
          value={carId}
          onChange={setCarId}
          onShuffle={() => setCarId(randomUnlockedCar(carId).id)}
        />
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
  input: {
    minHeight: 168,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 17,
    lineHeight: 25,
  },
  center: { alignItems: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  previewText: { flex: 1, gap: Spacing.one },
  // Absolute so the old and new car overlap in the spot while one leaves and the other arrives.
  previewCar: { position: 'absolute', top: 0 },
});
