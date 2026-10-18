import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'crisis';

const VARIANTS: Record<Variant, { background: ThemeColor; text: ThemeColor }> = {
  primary: { background: 'accent', text: 'accentText' },
  secondary: { background: 'backgroundElement', text: 'text' },
  crisis: { background: 'crisis', text: 'crisisText' },
};

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'primary', accessibilityHint }: Props) {
  const theme = useTheme();
  const colors = VARIANTS[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme[colors.background] },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="default" style={styles.label} themeColor={colors.text}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  label: { fontWeight: 600, textAlign: 'center' },
});
