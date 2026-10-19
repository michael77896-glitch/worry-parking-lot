import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { RARITY_COLOR, type Rarity } from '@/constants/rarity';
import type { Slot } from '@/constants/parts';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SYMBOL: Record<Slot, 'circle.circle.fill' | 'wind' | 'lightbulb.fill' | 'rectangle.fill' | 'star.fill'> = {
  rims: 'circle.circle.fill',
  spoiler: 'wind',
  underglow: 'lightbulb.fill',
  plate: 'rectangle.fill',
  stickers: 'star.fill',
};

/**
 * Placeholder picture for a mod part: a symbol for its slot, in its rarity color. Swap this for
 * real part art later; nothing else needs to change. Decorative.
 */
export function PartTile({ slot, rarity, size = 56 }: { slot: Slot; rarity: Rarity; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderColor: RARITY_COLOR[rarity], backgroundColor: theme.backgroundSelected },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <SymbolView name={SYMBOL[slot]} tintColor={RARITY_COLOR[rarity]} size={size * 0.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: Radius.chip, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
