import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { BackLink } from '@/components/back-link';
import { Car } from '@/components/lot/car';
import { ParkingSpot } from '@/components/lot/parking-spot';
import { PartTile } from '@/components/lot/part-tile';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TokenChip } from '@/components/token-chip';
import { getCar } from '@/constants/car-catalog';
import {
  FINISH_ORDER,
  FINISHES,
  finishUnlocked,
  paintsOfFinish,
  STOCK_PAINT,
  type Finish,
  type PaintDef,
} from '@/constants/paints';
import { getPart, partPrice, partsInSlot, SLOT_LABEL, SLOTS, type PartDef, type Slot } from '@/constants/parts';
import { RARITY_COLOR, RARITY_LABEL } from '@/constants/rarity';
import { Radius, Spacing } from '@/constants/theme';
import {
  buyPaint,
  buyPart,
  getFinishedWindowCount,
  getTokenBalance,
  installPart,
  listCarPaints,
  listOwnedCars,
  listOwnedParts,
  listUnlockedPaints,
  setStockPaint,
  uninstallPart,
  type OwnedCar,
  type OwnedPart,
  type ShopResult,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { ownedCarName, paintName } from '@/utils/garage';

type Loaded = {
  cars: OwnedCar[];
  parts: OwnedPart[];
  balance: number;
  finished: number;
  wonPaints: string[];
};

/** A small capsule button used inside rows. At least 44 pt tall. */
function SmallButton({
  label,
  onPress,
  primary = false,
  disabled = false,
  hint,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        {
          backgroundColor: primary ? theme.accent : theme.backgroundSelected,
          borderColor: primary ? theme.accent : theme.border,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" themeColor={primary ? 'accentText' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Chip({ label, selected, onPress, hint }: { label: string; selected: boolean; onPress: () => void; hint?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}>
      <ThemedText type="smallBold" themeColor={selected ? 'accentText' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Swatch({ paint, dim }: { paint: PaintDef; dim: boolean }) {
  const theme = useTheme();
  const id = `sw-${paint.id}`;
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44" opacity={dim ? 0.4 : 1} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={paint.color} />
          <Stop offset="1" stopColor={paint.color2 ?? paint.color} />
        </LinearGradient>
      </Defs>
      <Circle cx="22" cy="22" r="19" fill={`url(#${id})`} stroke={theme.border} strokeWidth="2" />
    </Svg>
  );
}

/** What a rejected shop action means, in plain words. */
function explain(result: ShopResult, price?: number, balance?: number): string | null {
  if (result.ok) return null;
  switch (result.reason) {
    case 'not-enough-tokens':
      return price !== undefined && balance !== undefined
        ? `You need ${price - balance} more tokens for that.`
        : "You don't have enough tokens for that yet.";
    case 'locked':
      return "That finish isn't unlocked yet.";
    case 'not-owned':
      return 'That paint can only be won from a Golden Crate.';
    case 'not-for-sale':
      return 'That part can only be found in boxes.';
    default:
      return "That didn't work. Please try again.";
  }
}

/**
 * The Mod shop: pick one of your cars, then spend tokens on paint and parts for it. Gloss paint
 * is open from the start; Matte, Metallic, Pearlescent, and Chrome open after 5, 15, 30, and 50
 * finished worry windows; Color-shift only comes from Golden Crates. Parts show as placeholders.
 */
export default function ShopScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { car: carParam } = useLocalSearchParams<{ car?: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(carParam ? Number(carParam) : null);
  const [carPaints, setCarPaints] = useState<string[]>([]);
  const [finish, setFinish] = useState<Finish>('gloss');
  const [slot, setSlot] = useState<Slot>('rims');

  const load = useCallback(async () => {
    const [cars, parts, balance, finished, wonPaints] = await Promise.all([
      listOwnedCars(db),
      listOwnedParts(db),
      getTokenBalance(db),
      getFinishedWindowCount(db),
      listUnlockedPaints(db),
    ]);
    setData({ cars, parts, balance, finished, wonPaints });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const selected = data ? (data.cars.find((c) => c.id === selectedId) ?? data.cars[0]) : null;
  const selectedCarId = selected?.id;

  useEffect(() => {
    if (selectedCarId === undefined) return;
    let active = true;
    listCarPaints(db, selectedCarId).then((paints) => {
      if (active) setCarPaints(paints);
    });
    return () => {
      active = false;
    };
  }, [db, selectedCarId, data]);

  if (!data || !selected) {
    return (
      <Screen>
        <BackLink />
        <ThemedText type="subtitle">Mod shop</ThemedText>
      </Screen>
    );
  }

  const def = getCar(selected.carId);
  const installed = data.parts.filter((p) => p.installedOn === selected.id);

  async function applyStock() {
    await setStockPaint(db, selected!.id);
    await load();
  }

  async function pickPaint(paint: PaintDef) {
    if (!data || !selected || selected.paint === paint.id) return;
    const isWon = data.wonPaints.includes(paint.id);
    if (paint.finish === 'colorshift' && !isWon) {
      Alert.alert('Golden Crates only', 'Color-shift paints can only be won from a Golden Crate. They aren’t for sale.');
      return;
    }
    const free = carPaints.includes(paint.id) || (paint.finish === 'colorshift' && isWon);
    const price = FINISHES[paint.finish].price ?? 0;
    const run = async () => {
      const result = await buyPaint(db, selected.id, paint.id);
      const message = explain(result, price, data.balance);
      if (message) Alert.alert("Couldn't do that", message);
      await load();
    };
    if (free) return run();
    if (data.balance < price) {
      Alert.alert('Not enough tokens', explain({ ok: false, reason: 'not-enough-tokens' }, price, data.balance) ?? '');
      return;
    }
    Alert.alert(`Buy ${paint.name}?`, `It costs ${price} tokens, and goes on your ${def.name}. You have ${data.balance}.`, [
      { text: 'Not now', style: 'cancel' },
      { text: `Buy for ${price}`, onPress: () => void run() },
    ]);
  }

  async function actOnPart(part: PartDef) {
    if (!data || !selected) return;
    const mine = data.parts.filter((p) => p.partId === part.id);
    const onThis = mine.find((p) => p.installedOn === selected.id);
    if (onThis) {
      await uninstallPart(db, onThis.id);
    } else {
      const spare = mine.find((p) => p.installedOn === null) ?? mine[0];
      if (spare) {
        await installPart(db, spare.id, selected.id);
      } else {
        const price = partPrice(part);
        if (price === null) return;
        if (data.balance < price) {
          Alert.alert('Not enough tokens', explain({ ok: false, reason: 'not-enough-tokens' }, price, data.balance) ?? '');
          return;
        }
        Alert.alert(`Buy ${part.name}?`, `It costs ${price} tokens, and goes on your ${def.name}. You have ${data.balance}.`, [
          { text: 'Not now', style: 'cancel' },
          {
            text: `Buy for ${price}`,
            onPress: async () => {
              const bought = await buyPart(db, part.id);
              if (bought.ok && bought.ownedPartId) await installPart(db, bought.ownedPartId, selected.id);
              else Alert.alert("Couldn't do that", explain(bought, price, data.balance) ?? '');
              await load();
            },
          },
        ]);
        return;
      }
    }
    await load();
  }

  const finishOpen = finishUnlocked(finish, data.finished);
  const info = FINISHES[finish];

  return (
    <Screen>
      <BackLink />
      <View style={styles.header}>
        <ThemedText type="subtitle">Mod shop</ThemedText>
        <TokenChip balance={data.balance} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carRow}
        accessibilityRole="radiogroup"
        accessibilityLabel="Choose a car">
        {data.cars.map((car) => {
          const isSelected = car.id === selected.id;
          return (
            <Pressable
              key={car.id}
              accessibilityRole="radio"
              accessibilityLabel={`${ownedCarName(car, data.cars)}, ${paintName(car.paint)}`}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              onPress={() => setSelectedId(car.id)}
              style={[
                styles.carTile,
                {
                  backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                },
              ]}>
              <Car carId={car.carId} paintId={car.paint} width={36} height={64} />
              <ThemedText type="caption" capScale numberOfLines={1}>
                {ownedCarName(car, data.cars)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ThemedView type="backgroundElement" style={styles.preview}>
        <ParkingSpot
          width={112}
          car={{ id: selected.carId, paint: selected.paint }}
          accessibilityLabel={`${ownedCarName(selected, data.cars)} in ${paintName(selected.paint)}`}
        />
        <View style={styles.previewText}>
          <ThemedText type="title">{ownedCarName(selected, data.cars)}</ThemedText>
          <ThemedText type="smallBold" style={{ color: RARITY_COLOR[def.rarity] }}>
            {RARITY_LABEL[def.rarity]} · {def.style}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {paintName(selected.paint)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {installed.length === 0
              ? 'No parts installed'
              : installed.map((p) => getPart(p.partId)?.name).join(', ')}
          </ThemedText>
        </View>
      </ThemedView>

      <ThemedText type="title" accessibilityRole="header">
        Paint
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FINISH_ORDER.map((f) => {
          const open = finishUnlocked(f, data.finished);
          const crate = f === 'colorshift';
          return (
            <Chip
              key={f}
              label={FINISHES[f].label}
              selected={f === finish}
              onPress={() => setFinish(f)}
              hint={
                crate
                  ? 'Only from Golden Crates'
                  : open
                    ? undefined
                    : `Unlocks after ${FINISHES[f].unlockWindows} finished worry windows`
              }
            />
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Original paint"
        accessibilityState={{ selected: selected.paint === STOCK_PAINT }}
        onPress={applyStock}
        style={styles.stockRow}>
        <ThemedText type="small" themeColor={selected.paint === STOCK_PAINT ? 'text' : 'textSecondary'} style={styles.underline}>
          {selected.paint === STOCK_PAINT ? 'Original paint is on' : 'Go back to the original paint'}
        </ThemedText>
      </Pressable>

      {finish === 'colorshift' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Color-shift paints fade from one color to another. They can&apos;t be bought: you win them
          from Golden Crates, and then they go on any car for free.
        </ThemedText>
      ) : !finishOpen ? (
        <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
          {info.label} unlocks after {info.unlockWindows} finished worry windows. You&apos;ve finished {data.finished} so far.
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {info.price} tokens per car. Paint you&apos;ve bought for a car stays yours, so you can switch back for free.
        </ThemedText>
      )}

      <View style={styles.swatches}>
        {paintsOfFinish(finish).map((paint) => {
          const won = data.wonPaints.includes(paint.id);
          const on = selected.paint === paint.id;
          const owned = carPaints.includes(paint.id) || (paint.finish === 'colorshift' && won);
          const locked = paint.finish === 'colorshift' ? !won : !finishOpen;
          const status = on
            ? 'On'
            : owned
              ? 'Owned'
              : paint.finish === 'colorshift'
                ? won
                  ? 'Free'
                  : 'Crates only'
                : locked
                  ? 'Locked'
                  : `${info.price}`;
          return (
            <Pressable
              key={paint.id}
              accessibilityRole="button"
              accessibilityLabel={`${paint.name}. ${status}${status === `${info.price}` ? ' tokens' : ''}`}
              accessibilityState={{ selected: on, disabled: locked && !owned }}
              onPress={() => (locked && !owned ? undefined : pickPaint(paint))}
              style={({ pressed }) => [styles.swatch, pressed && styles.pressed]}>
              <Swatch paint={paint} dim={locked && !owned} />
              <ThemedText type="caption" capScale style={styles.swatchText}>
                {paint.name.replace(`${info.label} `, '')}
              </ThemedText>
              <ThemedText type="caption" capScale themeColor="textSecondary" style={styles.swatchText}>
                {status}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="title" accessibilityRole="header">
        Parts
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SLOTS.map((s) => (
          <Chip key={s} label={SLOT_LABEL[s]} selected={s === slot} onPress={() => setSlot(s)} />
        ))}
      </ScrollView>
      <ThemedText type="small" themeColor="textSecondary">
        Epic and Legendary parts only come from boxes. Part pictures are placeholders for now.
      </ThemedText>

      {partsInSlot(slot).map((part) => {
        const mine = data.parts.filter((p) => p.partId === part.id);
        const onThis = mine.some((p) => p.installedOn === selected.id);
        const spare = mine.find((p) => p.installedOn === null);
        const elsewhere = mine.length > 0 && !spare && !onThis;
        const price = partPrice(part);
        const status = onThis
          ? 'Installed'
          : spare
            ? 'Owned'
            : elsewhere
              ? 'On another car'
              : price !== null
                ? `${price} tokens`
                : 'Only from boxes';
        const action = onThis ? 'Remove' : mine.length > 0 ? 'Install' : price !== null ? `Buy ${price}` : null;
        return (
          <ThemedView key={part.id} type="backgroundElement" style={styles.partRow}>
            <PartTile slot={part.slot} rarity={part.rarity} />
            <View style={styles.partText}>
              <ThemedText type="headline">{part.name}</ThemedText>
              <ThemedText type="smallBold" style={{ color: RARITY_COLOR[part.rarity] }}>
                {RARITY_LABEL[part.rarity]}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {status}
              </ThemedText>
            </View>
            {action && <SmallButton label={action} primary={!onThis} onPress={() => void actOnPart(part)} />}
          </ThemedView>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  carRow: { gap: Spacing.two, paddingVertical: Spacing.one },
  carTile: {
    width: 84,
    minHeight: 44,
    borderRadius: Radius.card - 4,
    borderWidth: 1.5,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  preview: { borderRadius: Radius.card, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  previewText: { flex: 1, gap: Spacing.one },
  chips: { gap: Spacing.two },
  chip: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radius.chip, borderWidth: 1, justifyContent: 'center' },
  stockRow: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  swatch: { width: 76, minHeight: 44, alignItems: 'center', gap: Spacing.half },
  swatchText: { textAlign: 'center' },
  partRow: { borderRadius: Radius.card, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  partText: { flex: 1, gap: Spacing.half },
  smallButton: { minHeight: 44, minWidth: 84, paddingHorizontal: Spacing.three, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
