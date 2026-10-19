/**
 * What comes out of a box. Pure: give it the box type, how many boxes have passed since the last
 * Epic-or-better, and a random function, and it says what the box holds. All the odds come from
 * src/constants/rewards.ts, the same numbers the odds screen shows.
 */
import { droppableCars } from '../constants/car-data';
import { COLOR_SHIFT_PAINTS } from '../constants/paints';
import { PARTS } from '../constants/parts';
import { isAtLeast, type Rarity } from '../constants/rarity';
import {
  GOLDEN_CHANCE,
  KIND_WEIGHTS,
  PITY_EVERY,
  PITY_WEIGHTS,
  RARITY_WEIGHTS,
  type BoxType,
} from '../constants/rewards';

export type Reward =
  | { kind: 'car'; carId: string; rarity: Rarity }
  | { kind: 'part'; partId: string; rarity: Rarity }
  | { kind: 'paint'; paintId: string; rarity: Rarity }
  /** A Golden Crate, given instead of a Glovebox's or Toolbox's usual contents. */
  | { kind: 'golden' };

export type Roll = {
  reward: Reward;
  /** True when this was the guaranteed Epic-or-better box. */
  byPity: boolean;
};

function pickWeighted<T extends string>(weights: Record<T, number>, random: () => number): T {
  const entries = (Object.entries(weights) as [T, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [key, w] of entries) {
    if (r < w) return key;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/**
 * Rolls one box.
 *  1. A Glovebox or Toolbox first has a small chance of being a Golden Crate instead.
 *  2. Otherwise the rarity is chosen. The box after nine without an Epic or better is guaranteed one.
 *  3. Then a car, a mod part, or (Golden Crates only) a color-shift paint of that rarity.
 *     If there is no car or paint of that rarity yet, the box gives a mod part, which always exists.
 */
export function rollBox(type: BoxType, sinceEpic: number, random: () => number = Math.random): Roll {
  if (type !== 'golden' && random() < GOLDEN_CHANCE[type]) {
    return { reward: { kind: 'golden' }, byPity: false };
  }

  const byPity = type !== 'golden' && sinceEpic >= PITY_EVERY - 1;
  const rarity = pickWeighted(byPity ? PITY_WEIGHTS : RARITY_WEIGHTS[type], random);

  let kind = pickWeighted(KIND_WEIGHTS[type], random);
  const cars = droppableCars(rarity);
  const parts = PARTS.filter((p) => p.rarity === rarity);
  const paints = COLOR_SHIFT_PAINTS.filter((p) => p.rarity === rarity);
  if (kind === 'car' && cars.length === 0) kind = 'part';
  if (kind === 'paint' && paints.length === 0) kind = 'part';

  if (kind === 'car') return { reward: { kind: 'car', carId: pickOne(cars, random).id, rarity }, byPity };
  if (kind === 'paint') {
    return { reward: { kind: 'paint', paintId: pickOne(paints, random).id, rarity }, byPity };
  }
  return { reward: { kind: 'part', partId: pickOne(parts, random).id, rarity }, byPity };
}

/** How many boxes have passed since the last Epic-or-better, after a box that gave `reward`. */
export function nextSinceEpic(previous: number, reward: Reward): number {
  if (reward.kind === 'golden') return 0;
  return isAtLeast(reward.rarity, 'epic') ? 0 : previous + 1;
}
