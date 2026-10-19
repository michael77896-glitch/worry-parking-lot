import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'crisis';

const VARIANTS: Record<Variant, { background: ThemeColor; text: ThemeColor; border: ThemeColor }> = {
  primary: { background: 'accent', text: 'accentText', border: 'accent' },
  secondary: { background: 'backgroundElement', text: 'text', border: 'border' },
  crisis: { background: 'crisis', text: 'crisisText', border: 'crisis' },
};

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  accessibilityHint?: string;
};

/** Capsule button, at least 52 pt tall. One primary button per screen; the rest are secondary. */
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
        { backgroundColor: theme[colors.background], borderColor: theme[colors.border] },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="headline" style={styles.label} themeColor={colors.text}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: Radius.button,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  label: { textAlign: 'center' },
});
