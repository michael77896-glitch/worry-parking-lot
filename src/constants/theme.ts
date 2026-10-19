/**
 * The night lot. Dark asphalt, soft painted lines, one warm lamp color.
 *
 * The app is dark-only on purpose: the parking lot at night is its identity, and it is meant to be
 * opened in the evening. There is no in-app appearance switch.
 *
 * Measured contrast (WCAG), on the background they are used on:
 *   text 15.5:1 · textSecondary 9.5:1 · accentText on accent 10.4:1 · accent on background 10.6:1
 *   crisisText on crisis 9.0:1 · ticketText on ticket 12.3:1 · ticketTextSecondary on ticket 5.9:1
 *   paint lines 3.9:1 (decorative only, never the sole carrier of meaning)
 */
import { Platform } from 'react-native';

export const Night = {
  /** Dark asphalt. */
  background: '#151922',
  /** Raised surfaces: cards, rows, the painted-spot tiles. */
  backgroundElement: '#1E2430',
  backgroundSelected: '#2A3140',
  border: '#2C3444',
  text: '#EEF1F7',
  textSecondary: '#B7BFCF',
  /** Painted lines. Decorative. */
  paint: '#6B7690',
  /** Warm lamp light. Used for the primary action and "the gate is open", nowhere else. */
  accent: '#F0C27B',
  accentText: '#231A08',
  /** Crisis help: a soft coral, steady and never animated. */
  crisis: '#F2A7A0',
  crisisText: '#2B1210',
  /** The parking ticket: cream paper. */
  ticket: '#ECE3CF',
  ticketText: '#26231D',
  ticketTextSecondary: '#5A5444',
  gatePost: '#3A4254',
} as const;

export type ThemeColor = keyof typeof Night;
export type Theme = Record<ThemeColor, string>;

/** Used automatically when the iPhone's Increase Contrast setting is on. */
export const NightHighContrast: Theme = {
  ...Night,
  textSecondary: '#DCE1EC',
  paint: '#98A3BC',
  border: '#4A5468',
  ticketTextSecondary: '#3F3A2E',
};

export const Fonts = {
  /** SF Pro Rounded: soft headings. */
  rounded: Platform.select({ ios: 'ui-rounded', default: 'normal' }),
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  card: 20,
  button: 26,
  chip: 22,
} as const;

export const MaxContentWidth = 800;
