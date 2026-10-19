import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Car } from '@/components/lot/car';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CAR_CATALOG,
  isUnlocked,
  STYLE_GROUPS,
  unlockedCars,
  type CarDefinition,
} from '@/constants/car-catalog';
import { Radius, Spacing } from '@/constants/theme';

const COLUMNS = 2;
const GAP = 12;
const PICTURE_HEIGHT = 150;

function GarageCard({ car, width }: { car: CarDefinition; width: number }) {
  const unlocked = isUnlocked(car);
  const label = unlocked
    ? `${car.name}, ${STYLE_GROUPS[car.style].spoken}`
    : 'Locked car. You can unlock it later.';

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { width }]}
      accessible
      accessibilityLabel={label}>
      <View style={styles.picture}>
        <Car carId={car.id} width={width * 0.56} height={PICTURE_HEIGHT} silhouette={!unlocked} />
      </View>
      <ThemedText type="headline">{unlocked ? car.name : 'Locked car'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {unlocked ? car.style : 'Unlocks later'}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * The collection: every car in the catalog, with its name and style group. Locked cars (none yet)
 * show as a dark silhouette with no name, so the Garage already has room for cars to find later.
 */
export default function GarageScreen() {
  const [width, setWidth] = useState(0);
  const cardWidth = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const owned = unlockedCars().length;

  const rows: CarDefinition[][] = [];
  for (let i = 0; i < CAR_CATALOG.length; i += COLUMNS) rows.push(CAR_CATALOG.slice(i, i + COLUMNS));

  return (
    <Screen>
      <ThemedText type="subtitle">Garage</ThemedText>
      <ThemedText themeColor="textSecondary">
        {owned === 1 ? '1 car in your collection.' : `${owned} cars in your collection.`} When you park
        a worry, one of them pulls into the lot, and you can swap it for another.
      </ThemedText>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.grid}>
        {cardWidth > 0 &&
          rows.map((row) => (
            <View key={row[0].id} style={styles.row}>
              {row.map((car) => (
                <GarageCard key={car.id} car={car} width={cardWidth} />
              ))}
            </View>
          ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  picture: { height: PICTURE_HEIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
});
