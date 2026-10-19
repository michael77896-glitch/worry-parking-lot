import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Car } from '@/components/lot/car';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { CAR_KINDS, CAR_LABELS, type CarKind } from '@/data';
import { useTheme } from '@/hooks/use-theme';

export type CarChoice = CarKind | 'random';

type Props = {
  value: CarChoice;
  onChange: (choice: CarChoice) => void;
};

const TILE_WIDTH = 92;
const PICTURE_HEIGHT = 84;

/** A row to choose which car a worry is parked as, or "Surprise me" to leave it to chance. */
export function CarPicker({ value, onChange }: Props) {
  const theme = useTheme();

  const options: { choice: CarChoice; label: string; description: string }[] = [
    { choice: 'random', label: 'Surprise me', description: 'Picks a car at random' },
    ...CAR_KINDS.map((kind) => ({ choice: kind, label: CAR_LABELS[kind], description: CAR_LABELS[kind] })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel="Choose a car">
      {options.map(({ choice, label, description }) => {
        const selected = value === choice;
        return (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityLabel={`${label}. ${choice === 'random' ? description : 'A car for this worry'}`}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(choice)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <View style={styles.picture}>
              {choice === 'random' ? (
                <ThemedText style={styles.question}>?</ThemedText>
              ) : (
                <Car kind={choice} width={TILE_WIDTH * 0.62} height={PICTURE_HEIGHT} />
              )}
            </View>
            <ThemedText type="caption" capScale numberOfLines={1} style={styles.label}>
              {label}
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
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  picture: { height: PICTURE_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  question: { fontFamily: Fonts.rounded, fontSize: 40, lineHeight: 48, fontWeight: 700 },
  label: { textAlign: 'center' },
  check: { position: 'absolute', top: 6, right: 6 },
  pressed: { opacity: 0.8 },
});
