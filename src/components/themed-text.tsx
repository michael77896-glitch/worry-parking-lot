import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'headline' | 'small' | 'smallBold' | 'caption' | 'title' | 'subtitle';
  themeColor?: ThemeColor;
  /** For small chrome like the crisis pill: keep it from growing past 130% of the system size. */
  capScale?: boolean;
};

/**
 * System text styles at their default Dynamic Type sizes. Everything scales with the user's
 * text-size setting. Nothing is below 13 pt and nothing is lighter than regular.
 */
export function ThemedText({ style, type = 'default', themeColor, capScale, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      maxFontSizeMultiplier={capScale ? 1.3 : undefined}
      style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 17, lineHeight: 25, fontWeight: 400 },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: 600 },
  small: { fontSize: 15, lineHeight: 21, fontWeight: 400 },
  smallBold: { fontSize: 15, lineHeight: 21, fontWeight: 600 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: 500 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 700, fontFamily: Fonts.rounded },
  subtitle: { fontSize: 34, lineHeight: 41, fontWeight: 700, fontFamily: Fonts.rounded },
});
