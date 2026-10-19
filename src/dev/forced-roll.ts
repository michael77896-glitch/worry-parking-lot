import type { Rarity } from '@/constants/rarity';
import type { BoxType } from '@/constants/rewards';

/**
 * Development only (never bundled into a release build; see the Garage tab). A scripted "random"
 * that makes `rollBox` give an item of a chosen rarity, so each reveal can be looked at without
 * waiting for luck. The real odds are untouched everywhere else.
 */
const SEQUENCES: Record<Rarity, number[]> = {
  // Glovebox: not a Golden Crate, then the rarity roll, then "part", then which part.
  common: [0.5, 0.1, 0.9, 0.4],
  rare: [0.5, 0.8, 0.9, 0.4],
  // Golden Crate: the rarity roll (Epic below .85, else Legendary), "part", then which part.
  epic: [0.1, 0.5, 0.4],
  legendary: [0.95, 0.5, 0.4],
};

export function forcedRandom(rarity: Rarity): () => number {
  const values = SEQUENCES[rarity];
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** Epic and Legendary come from a Golden Crate (which is always Epic or better). */
export function forcedBoxType(rarity: Rarity): BoxType {
  return rarity === 'epic' || rarity === 'legendary' ? 'golden' : 'glovebox';
}
