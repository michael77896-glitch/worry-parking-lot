/** Paint finishes and colors. Pure data and a little math, so the data layer and tests can use it. */
import type { Rarity } from './rarity';

export type Finish = 'gloss' | 'matte' | 'metallic' | 'pearlescent' | 'chrome' | 'colorshift';

/** A car's original paint: its picture as it is. Free, and every car always has it. */
export const STOCK_PAINT = 'stock';

type FinishInfo = {
  label: string;
  /** Finished worry windows needed before this finish can be bought. */
  unlockWindows: number;
  /** Tokens per car. Color-shift has no price: it only comes from Golden Crates. */
  price: number | null;
  /** How the picture is recolored. See `paintMatrix`. */
  look: { gain: number; contrast: number; mix: number };
};

export const FINISH_ORDER: readonly Finish[] = ['gloss', 'matte', 'metallic', 'pearlescent', 'chrome', 'colorshift'];

export const FINISHES: Record<Finish, FinishInfo> = {
  gloss: { label: 'Gloss', unlockWindows: 0, price: 40, look: { gain: 1.45, contrast: 1.15, mix: 0 } },
  matte: { label: 'Matte', unlockWindows: 5, price: 70, look: { gain: 1.25, contrast: 0.7, mix: 0.1 } },
  metallic: { label: 'Metallic', unlockWindows: 15, price: 110, look: { gain: 1.5, contrast: 1.5, mix: 0.2 } },
  pearlescent: { label: 'Pearlescent', unlockWindows: 30, price: 160, look: { gain: 1.2, contrast: 1.0, mix: 0.45 } },
  chrome: { label: 'Chrome', unlockWindows: 50, price: 250, look: { gain: 1.3, contrast: 1.9, mix: 0.3 } },
  colorshift: { label: 'Color-shift', unlockWindows: 0, price: null, look: { gain: 1.45, contrast: 1.15, mix: 0 } },
};

export type PaintDef = {
  /** e.g. "gloss-sky". Stored on cars. Never change one. */
  id: string;
  finish: Finish;
  name: string;
  /** Main color. */
  color: string;
  /** Second color, for color-shift paints, which fade from the first to this one. */
  color2?: string;
  /** Set on color-shift paints, which come from Golden Crates. */
  rarity?: Rarity;
};

/** About ten calm colors. Gloss, matte, metallic, and pearlescent all come in these. */
export const PAINT_COLORS = [
  { id: 'sky', name: 'Sky', hex: '#6FA8D8' },
  { id: 'mint', name: 'Mint', hex: '#7FCDB0' },
  { id: 'lavender', name: 'Lavender', hex: '#A99BD6' },
  { id: 'peach', name: 'Peach', hex: '#E8A98A' },
  { id: 'rose', name: 'Rose', hex: '#D98FA0' },
  { id: 'butter', name: 'Butter', hex: '#E6CF7A' },
  { id: 'teal', name: 'Teal', hex: '#4FA7A5' },
  { id: 'slate', name: 'Slate', hex: '#7B879C' },
  { id: 'cherry', name: 'Cherry', hex: '#C5605E' },
  { id: 'midnight', name: 'Midnight', hex: '#3B4F8A' },
] as const;

const CHROME_TINTS = [
  { id: 'silver', name: 'Silver', hex: '#E6EAF2' },
  { id: 'gold', name: 'Gold', hex: '#F0CE86' },
  { id: 'rose-gold', name: 'Rose Gold', hex: '#EBB3A8' },
  { id: 'black', name: 'Black', hex: '#7A8092' },
] as const;

const COLOR_SHIFT: readonly PaintDef[] = [
  { id: 'colorshift-dusk', finish: 'colorshift', name: 'Dusk Shift', color: '#7B6CF6', color2: '#F08A6A', rarity: 'epic' },
  { id: 'colorshift-ocean', finish: 'colorshift', name: 'Ocean Shift', color: '#3FA9D8', color2: '#7DE0A5', rarity: 'epic' },
  { id: 'colorshift-aurora', finish: 'colorshift', name: 'Aurora Shift', color: '#5BE0B0', color2: '#B07CF5', rarity: 'legendary' },
  { id: 'colorshift-opal', finish: 'colorshift', name: 'Opal Shift', color: '#F5B8D0', color2: '#9BD9F0', rarity: 'legendary' },
];

const SHOP_FINISHES: Finish[] = ['gloss', 'matte', 'metallic', 'pearlescent'];

export const PAINTS: readonly PaintDef[] = [
  ...SHOP_FINISHES.flatMap((finish) =>
    PAINT_COLORS.map<PaintDef>((c) => ({
      id: `${finish}-${c.id}`,
      finish,
      name: `${FINISHES[finish].label} ${c.name}`,
      color: c.hex,
    })),
  ),
  ...CHROME_TINTS.map<PaintDef>((c) => ({
    id: `chrome-${c.id}`,
    finish: 'chrome',
    name: `Chrome ${c.name}`,
    color: c.hex,
  })),
  ...COLOR_SHIFT,
];

export const COLOR_SHIFT_PAINTS: readonly PaintDef[] = COLOR_SHIFT;

export function getPaint(id: string): PaintDef | undefined {
  return PAINTS.find((p) => p.id === id);
}

export function paintsOfFinish(finish: Finish): PaintDef[] {
  return PAINTS.filter((p) => p.finish === finish);
}

/** True once enough worry windows are finished to buy this finish. Color-shift never opens this way. */
export function finishUnlocked(finish: Finish, finishedWindows: number): boolean {
  return finish !== 'colorshift' && finishedWindows >= FINISHES[finish].unlockWindows;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * A 4x5 color matrix (20 numbers, row by row) that recolors a car picture: it turns the picture
 * into its brightness, then tints that with the paint color. Windows and tires stay dark, and the
 * body takes the paint. Used with an SVG feColorMatrix filter.
 *   brightness   L = 0.2126 R + 0.7152 G + 0.0722 B
 *   shaped       S = contrast * (L - 0.5) + 0.5
 *   tinted       out = (1 - mix) * gain * color * S + mix * S
 * Alpha is kept as it is.
 */
export function paintMatrix(finish: Finish, hex: string): number[] {
  const { gain, contrast, mix } = FINISHES[finish].look;
  const weights = [0.2126, 0.7152, 0.0722];
  const rgb = hexToRgb(hex);
  const rows: number[] = [];
  for (const channel of rgb) {
    const k = (1 - mix) * gain * channel + mix;
    rows.push(k * contrast * weights[0], k * contrast * weights[1], k * contrast * weights[2], 0, k * (0.5 - 0.5 * contrast));
  }
  rows.push(0, 0, 0, 1, 0);
  return rows;
}
