import { Night, NightHighContrast, type Theme } from '@/constants/theme';
import { useIncreasedContrast } from '@/hooks/use-increased-contrast';

/** The night palette, or its higher-contrast variant when Increase Contrast is on. */
export function useTheme(): Theme {
  return useIncreasedContrast() ? NightHighContrast : Night;
}
