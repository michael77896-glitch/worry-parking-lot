import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Vertical space screens must leave at the top for the crisis button. */
export const CRISIS_BAR_HEIGHT = 56;

/**
 * Always-visible entry point to the crisis resources screen. Rendered once in the
 * root layout, above every screen. Don't present screens as native modals or sheets:
 * they draw above this button. It is a steady soft-coral outline and never animates.
 */
export function CrisisButton() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  if (pathname === '/crisis') return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Crisis help"
      accessibilityHint="Opens phone numbers for 988 and other crisis support"
      onPress={() => router.push('/crisis')}
      style={({ pressed }) => [
        styles.pill,
        {
          top: insets.top + Spacing.one,
          backgroundColor: theme.backgroundElement,
          borderColor: theme.crisis,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" capScale>
        Crisis help
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: Spacing.three,
    zIndex: 10,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.75 },
});
