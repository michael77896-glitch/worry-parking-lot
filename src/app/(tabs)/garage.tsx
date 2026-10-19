import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { BoxArt } from '@/components/lot/box-art';
import { Car } from '@/components/lot/car';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TokenChip } from '@/components/token-chip';
import { CAR_CATALOG, getCar, STYLE_GROUPS } from '@/constants/car-catalog';
import { RARITY_COLOR, RARITY_LABEL } from '@/constants/rarity';
import { BOX_LABEL } from '@/constants/rewards';
import { Radius, Spacing } from '@/constants/theme';
import {
  getTokenBalance,
  listBoxes,
  listOwnedCars,
  listOwnedParts,
  type Box,
  type OwnedCar,
  type OwnedPart,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { ownedCarName, paintName } from '@/utils/garage';

// Development-only panel for trying every rarity. The `require` sits behind `__DEV__` so release
// builds don't bundle it at all.
const BoxTester: React.ComponentType | undefined = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/box-tester').BoxTester
  : undefined;

const COLUMNS = 2;
const GAP = 12;
const PICTURE_HEIGHT = 150;

type Loaded = { cars: OwnedCar[]; parts: OwnedPart[]; boxes: Box[]; balance: number };

/** A short, calm line for where a box came from. */
function boxSource(box: Box): string {
  const [kind, detail] = box.source.split(':');
  if (kind === 'window') return 'For finishing a worry window';
  if (kind === 'week') return 'For finishing 5 worry windows in one week';
  if (kind === 'milestone') return `For letting go of your ${detail}th worry`;
  if (kind === 'trade') return 'From trading a duplicate car';
  if (kind === 'drop') return 'It was inside another box';
  return 'Earned';
}

function BoxRow({ box }: { box: Box }) {
  const theme = useTheme();
  const waiting = !!box.openedAt && !box.resolvedAt;
  return (
    <View style={styles.boxRow}>
      <BoxArt type={box.type} width={64} />
      <View style={styles.boxText}>
        <ThemedText type="headline">{BOX_LABEL[box.type]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {waiting ? 'A duplicate car is waiting for your choice' : boxSource(box)}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${waiting ? 'Decide on' : 'Open'} ${BOX_LABEL[box.type]}. ${boxSource(box)}`}
        onPress={() => router.push({ pathname: '/open-box', params: { id: String(box.id) } })}
        style={({ pressed }) => [styles.openButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
        <ThemedText type="smallBold" themeColor="accentText">
          {waiting ? 'Decide' : 'Open'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function OwnedCard({ car, all, parts, width }: { car: OwnedCar; all: OwnedCar[]; parts: OwnedPart[]; width: number }) {
  const def = getCar(car.carId);
  const name = ownedCarName(car, all);
  const installed = parts.filter((p) => p.installedOn === car.id).length;
  const label = `${name}. ${RARITY_LABEL[def.rarity]}. ${STYLE_GROUPS[def.style].spoken}. ${paintName(car.paint)}. ${installed} ${installed === 1 ? 'part' : 'parts'} installed.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the Mod shop for this car"
      onPress={() => router.push({ pathname: '/shop', params: { car: String(car.id) } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={[styles.card, { width }]}>
        <View style={styles.picture}>
          <Car carId={car.carId} paintId={car.paint} width={width * 0.56} height={PICTURE_HEIGHT} />
        </View>
        <ThemedText type="headline">{name}</ThemedText>
        <ThemedText type="smallBold" style={{ color: RARITY_COLOR[def.rarity] }}>
          {RARITY_LABEL[def.rarity]}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {def.style} · {paintName(car.paint)}
        </ThemedText>
        {installed > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {installed} {installed === 1 ? 'part' : 'parts'} installed
          </ThemedText>
        )}
      </ThemedView>
    </Pressable>
  );
}

function LockedCard({ carId, width }: { carId: string; width: number }) {
  const def = getCar(carId);
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { width }]}
      accessible
      accessibilityLabel={`Locked ${RARITY_LABEL[def.rarity]} car. You can unlock it later.`}>
      <View style={styles.picture}>
        <Car carId={carId} width={width * 0.56} height={PICTURE_HEIGHT} silhouette />
      </View>
      <ThemedText type="headline">Locked car</ThemedText>
      <ThemedText type="smallBold" style={{ color: RARITY_COLOR[def.rarity] }}>
        {RARITY_LABEL[def.rarity]}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Unlocks later
      </ThemedText>
    </ThemedView>
  );
}

/**
 * The Garage: your tokens, the boxes you've earned, and every car you own (each copy can be
 * painted and modded on its own). Cars you don't have yet show as silhouettes.
 */
export default function GarageScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [data, setData] = useState<Loaded | null>(null);
  const [width, setWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [cars, parts, boxes, balance] = await Promise.all([
          listOwnedCars(db),
          listOwnedParts(db),
          listBoxes(db),
          getTokenBalance(db),
        ]);
        if (active) setData({ cars, parts, boxes, balance });
      })();
      return () => {
        active = false;
      };
    }, [db]),
  );

  const cardWidth = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const ownedIds = new Set(data?.cars.map((c) => c.carId));
  const locked = CAR_CATALOG.filter((c) => !ownedIds.has(c.id));

  const tiles: { key: string; node: (w: number) => React.ReactNode }[] = [
    ...(data?.cars ?? []).map((car) => ({
      key: `car-${car.id}`,
      node: (w: number) => <OwnedCard car={car} all={data!.cars} parts={data!.parts} width={w} />,
    })),
    ...locked.map((c) => ({ key: `locked-${c.id}`, node: (w: number) => <LockedCard carId={c.id} width={w} /> })),
  ];
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += COLUMNS) rows.push(tiles.slice(i, i + COLUMNS));

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Garage</ThemedText>
        {data && <TokenChip balance={data.balance} />}
      </View>

      {data && (
        <>
          <ThemedView type="backgroundElement" style={styles.panel}>
            <ThemedText type="headline" accessibilityRole="header">
              Boxes
            </ThemedText>
            {data.boxes.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                No boxes waiting. You earn a Glovebox each time you finish a worry window. Boxes can
                only be earned, never bought.
              </ThemedText>
            ) : (
              data.boxes.map((box) => <BoxRow key={box.id} box={box} />)
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See what's in the boxes, the odds, and how to earn them"
              onPress={() => router.push('/box-odds')}
              hitSlop={8}
              style={styles.link}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
                What&apos;s in the boxes and the odds
              </ThemedText>
            </Pressable>
          </ThemedView>

          {BoxTester && <BoxTester />}

          <Button label="Mod shop" variant="secondary" onPress={() => router.push('/shop')} />

          <ThemedText type="headline" accessibilityRole="header">
            Your cars ({data.cars.length})
          </ThemedText>
        </>
      )}

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.grid}>
        {cardWidth > 0 &&
          rows.map((row) => (
            <View key={row[0].key} style={styles.row}>
              {row.map((tile) => (
                <View key={tile.key}>{tile.node(cardWidth)}</View>
              ))}
            </View>
          ))}
      </View>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      <ThemedText type="small" themeColor="textSecondary">
        Tap a car to paint it or add parts.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  panel: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  boxText: { flex: 1, gap: Spacing.half },
  openButton: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  card: { borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one },
  picture: { height: PICTURE_HEIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  rule: { height: 1 },
  pressed: { opacity: 0.8 },
});
