import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Car } from '@/components/lot/car';
import { ThemedText } from '@/components/themed-text';
import { STYLE_GROUPS, unlockedCars } from '@/constants/car-catalog';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** The selected car's id. */
  value: string;
  onChange: (carId: string) => void;
  /** Called when "Surprise me" is tapped. The screen decides which car comes next. */
  onShuffle: () => void;
};

const TILE_WIDTH = 96;
const PICTURE_HEIGHT = 92;

/**
 * A row of the cars you can park as (locked cars are left out), with "Surprise me" first.
 * It scrolls sideways, so it grows as more cars are added to the catalog.
 */
export function CarPicker({ value, onChange, onShuffle }: Props) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel="Choose a car">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Surprise me. Picks a different car at random."
        onPress={onShuffle}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <View style={styles.picture}>
          <ThemedText style={styles.question}>?</ThemedText>
        </View>
        <ThemedText type="caption" capScale numberOfLines={1} style={styles.label}>
          Surprise me
        </ThemedText>
      </Pressable>

      {unlockedCars().map((car) => {
        const selected = car.id === value;
        return (
          <Pressable
            key={car.id}
            accessibilityRole="radio"
            accessibilityLabel={`${car.name}, ${STYLE_GROUPS[car.style].spoken}`}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(car.id)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <View style={styles.picture}>
              <Car carId={car.id} width={TILE_WIDTH * 0.62} height={PICTURE_HEIGHT} />
            </View>
            <ThemedText type="caption" capScale numberOfLines={1} style={styles.label}>
              {car.name}
            </ThemedText>
            {selected && (
              <View style={styles.check} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <SymbolView name="checkmark.circle.fill" tintColor={theme.accent} size={20} />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two, paddingVertical: Spacing.one },
  tile: {
    width: TILE_WIDTH,
    minHeight: 44,
    borderRadius: Radius.card - 4,
    borderWidth: 1.5,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  picture: { height: PICTURE_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  question: { fontFamily: Fonts.rounded, fontSize: 40, lineHeight: 48, fontWeight: 700 },
  label: { textAlign: 'center' },
  check: { position: 'absolute', top: 6, right: 6 },
  pressed: { opacity: 0.8 },
});
