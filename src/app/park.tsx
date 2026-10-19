import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { CarPicker } from '@/components/lot/car-picker';
import { ParkingSpot, SpotCar } from '@/components/lot/parking-spot';
import { ParkingTicket } from '@/components/lot/ticket';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getCar } from '@/constants/car-catalog';
import { Radius, Spacing } from '@/constants/theme';
import {
  getSettings,
  getTokenBalance,
  listOwnedCars,
  listParked,
  MAX_WORRY_LENGTH,
  nextWindowOpen,
  parkWorry,
  type OwnedCar,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, formatWhen } from '@/utils/format';
import { ownedCarName, paintName } from '@/utils/garage';

/** Show the character count only when the user is getting close to the limit. */
const COUNTER_THRESHOLD = MAX_WORRY_LENGTH - 200;
const PREVIEW_WIDTH = 136;

type Parked = { id: number; car: OwnedCar; space: number; parkedAt: Date; unlocksAt: Date; tokens: number };

/** A random car from the garage, avoiding `exclude` when there is another to choose. */
function randomOwned(cars: readonly OwnedCar[], exclude?: number): OwnedCar {
  const pool = cars.length > 1 ? cars.filter((c) => c.id !== exclude) : cars;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function ParkWorryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [parked, setParked] = useState<Parked | null>(null);
  // A random car from the garage pulls into the spot. Until the worry is parked, it can be swapped.
  const [garage, setGarage] = useState<OwnedCar[] | null>(null);
  const [carId, setCarId] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    let active = true;
    listOwnedCars(db).then((cars) => {
      if (!active || cars.length === 0) return;
      setGarage(cars);
      setCarId(randomOwned(cars).id);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const car = garage?.find((c) => c.id === carId) ?? null;
  const def = car ? getCar(car.carId) : null;
  const canPark = text.trim().length > 0 && !saving && !!car;

  async function park() {
    if (!canPark || !car) return;
    setSaving(true);
    try {
      const now = new Date();
      const settings = await getSettings(db);
      const before = await getTokenBalance(db);
      const id = await parkWorry(db, text, settings, now, car.carId, car.id);
      const tokens = (await getTokenBalance(db)) - before;
      const space = (await listParked(db)).length;
      // The text is cleared as soon as it is saved and is never shown again until the gate opens.
      setText('');
      setSwapping(false);
      setParked({ id, car, space, tokens, parkedAt: now, unlocksAt: nextWindowOpen(now, settings) });
    } catch {
      Alert.alert("Couldn't park that", 'Your worry was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (parked) {
    const name = ownedCarName(parked.car, garage ?? [parked.car]);
    return (
      <Screen>
        <BackLink />
        <ThemedText type="subtitle">Parked.</ThemedText>
        <ThemedText>
          Your {name.toLowerCase()} is in space {parked.space}. The gate opens {formatWhen(parked.unlocksAt)}. You
          don&apos;t have to hold onto it until then.
        </ThemedText>
        {parked.tokens > 0 && (
          <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
            +{parked.tokens} tokens
          </ThemedText>
        )}
        <View style={styles.center}>
          <ParkingSpot
            number={parked.space}
            width={140}
            car={{ id: parked.car.carId, paint: parked.car.paint }}
            enterDelay={150}
            accessibilityLabel={`Your ${name.toLowerCase()} in space ${parked.space}`}
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
            if (garage) setCarId(randomOwned(garage, parked.car.id).id);
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

      {car && def && garage && (
        <>
          <View style={styles.preview}>
            <ParkingSpot
              width={PREVIEW_WIDTH}
              selected={swapping}
              onPress={() => setSwapping((open) => !open)}
              accessibilityLabel={`${ownedCarName(car, garage)}, ${def.style}, ${paintName(car.paint)}. Tap to swap for a different car.`}
              slot={
                // A new key makes the new car pull in while the old one backs out, in the same spot.
                <Animated.View
                  key={car.id}
                  style={styles.previewCar}
                  entering={FadeInDown.duration(600)
                    .easing(Easing.out(Easing.cubic))
                    .reduceMotion(ReduceMotion.System)}
                  exiting={FadeOutDown.duration(250).reduceMotion(ReduceMotion.System)}>
                  <SpotCar carId={car.carId} paintId={car.paint} spotWidth={PREVIEW_WIDTH} />
                </Animated.View>
              }
            />
            <View style={styles.previewText}>
              <ThemedText type="caption" themeColor="textSecondary">
                YOUR CAR
              </ThemedText>
              <ThemedText type="title">{ownedCarName(car, garage)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {def.style} · {paintName(car.paint)}
              </ThemedText>
              <Button
                label={swapping ? 'Keep this car' : 'Swap car'}
                variant="secondary"
                onPress={() => setSwapping((open) => !open)}
                accessibilityHint={swapping ? 'Closes the list of cars' : 'Shows the other cars in your garage'}
              />
            </View>
          </View>
          {swapping && (
            <CarPicker
              cars={garage}
              value={car.id}
              onChange={setCarId}
              onShuffle={() => setCarId(randomOwned(garage, car.id).id)}
            />
          )}
        </>
      )}

      <Button
        label={saving ? 'Parking…' : 'Park it'}
        disabled={!car}
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
