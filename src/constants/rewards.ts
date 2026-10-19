/**
 * The reward rules in one place. Pure data, so the data layer, the tests, and the odds screen all
 * read the same numbers.
 *
 * Ground rules (see CLAUDE.md): everything stays on the phone; boxes can never be bought with real
 * money; nothing resets or punishes (no streaks that break); no timers or pressure.
 */
import type { Rarity } from './rarity';

export const TOKENS = {
  /** For parking a worry, but only for the first few each day. */
  park: 5,
  parkPerDay: 3,
  /** For finishing a worry window. */
  window: 20,
  /** For each "Did this actually happen?" answer, whichever answer it is. */
  outcome: 10,
} as const;

export type BoxType = 'glovebox' | 'toolbox' | 'golden';

export const BOX_LABEL: Record<BoxType, string> = {
  glovebox: 'Glovebox',
  toolbox: 'Toolbox',
  golden: 'Golden Crate',
};

/** Finished windows in one calendar week that earn a Toolbox. */
export const TOOLBOX_WINDOWS_PER_WEEK = 5;

/** Worries let go of that each earn a Golden Crate. */
export const GOLDEN_MILESTONES: readonly number[] = [10, 25, 50];

function ordinal(n: number): string {
  return `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
}

export const BOX_EARNED_BY: Record<BoxType, string> = {
  glovebox: 'Finish a worry window.',
  toolbox: `Finish ${TOOLBOX_WINDOWS_PER_WEEK} worry windows in one week (Monday to Sunday).`,
  golden: `Let go of your ${GOLDEN_MILESTONES.map(ordinal).join(', ')} worry. Also a small chance from a Glovebox or Toolbox.`,
};

/** The chance that opening a box gives a Golden Crate instead of its usual contents. */
export const GOLDEN_CHANCE: Record<'glovebox' | 'toolbox', number> = { glovebox: 0.02, toolbox: 0.05 };

/** Every Nth box opened is guaranteed Epic or better, unless one already was in the last N - 1. */
export const PITY_EVERY = 10;

/** Relative chance of each rarity, per box type. */
export const RARITY_WEIGHTS: Record<BoxType, Record<Rarity, number>> = {
  glovebox: { common: 70, rare: 22, epic: 7, legendary: 1 },
  toolbox: { common: 40, rare: 40, epic: 17, legendary: 3 },
  golden: { common: 0, rare: 0, epic: 85, legendary: 15 },
};

/** The rarity roll for the box that is guaranteed Epic or better. */
export const PITY_WEIGHTS: Record<Rarity, number> = { common: 0, rare: 0, epic: 88, legendary: 12 };

/** Relative chance of a car, a mod part, or a color-shift paint, once the rarity is chosen. */
export const KIND_WEIGHTS: Record<BoxType, { car: number; part: number; paint: number }> = {
  glovebox: { car: 50, part: 50, paint: 0 },
  toolbox: { car: 15, part: 85, paint: 0 },
  golden: { car: 25, part: 50, paint: 25 },
};

/** Tokens given instead when a box gives a color-shift paint you already have. */
export const DUPLICATE_PAINT_TOKENS = 100;
