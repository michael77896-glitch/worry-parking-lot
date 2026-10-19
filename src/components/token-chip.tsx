import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The token balance: a small coin and a number. A calm count, never a countdown. */
export function TokenChip({ balance }: { balance: number }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      accessible
      accessibilityLabel={`${balance} ${balance === 1 ? 'token' : 'tokens'}`}>
      <View style={[styles.coin, { borderColor: theme.textSecondary }]} />
      <ThemedText type="smallBold">{balance}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  coin: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
});
