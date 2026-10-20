/**
 * The numbers behind the loud box-opening screen, kept pure so the safety limits can be tested
 * without a phone. Only the box screen is flashy; these limits keep it from being harmful:
 * no more than three light flashes in any second, flashes never fully white, every fade to or from
 * black takes a visible moment, and haptics are rationed.
 */

/** How long a full hold-to-charge takes. */
export const CHARGE_MS = 1800;

/** No light flash may cover the screen brighter than this (0 to 1). */
export const MAX_FLASH_ALPHA = 0.4;

/** Never more than this many flash onsets in any one second (a common photosensitivity limit). */
export const MAX_FLASHES_PER_SECOND = 3;

/** 0 to 1: how charged the box is after being held for `heldMs`. */
export function chargeLevel(heldMs: number): number {
  return Math.min(1, Math.max(0, heldMs / CHARGE_MS));
}

export type HapticStrength = 'light' | 'medium' | 'heavy';

/** While charging: how long to wait before the next buzz, and how firm it is. Builds up. */
export function chargeHaptic(level: number): { gapMs: number; strength: HapticStrength } {
  const l = Math.min(1, Math.max(0, level));
  return {
    gapMs: Math.round(190 - 130 * l), // 190 ms down to 60 ms
    strength: l < 0.4 ? 'light' : l < 0.8 ? 'medium' : 'heavy',
  };
}

/** How many sparks are flying for a given charge: none until it starts to fill. */
export function sparkCount(level: number, max: number): number {
  return Math.floor(Math.min(1, Math.max(0, level)) * max);
}

/**
 * Reel tick haptics. The reel is too fast to feel each card in the first part of the spin (and
 * ticking there made it stutter), so ticks begin once it has slowed, then get further apart as it
 * does. `progress` is how far through the spin's time we are (0 to 1); `sinceLastMs` is the time
 * since the last tick buzz. At most about four a second.
 */
export const REEL_HAPTIC_START = 0.55;
export function reelTickAllowed(progress: number, sinceLastMs: number): boolean {
  if (progress < REEL_HAPTIC_START) return false;
  const t = Math.min(1, (progress - REEL_HAPTIC_START) / (1 - REEL_HAPTIC_START));
  const gap = 240 + 260 * t; // 240 ms, easing out to 500 ms
  return sinceLastMs >= gap;
}

export type Flicker = {
  /** Milliseconds after the landing. */
  at: number;
  /** How long the bolts show. */
  durationMs: number;
  /** Peak opacity of the light, never above MAX_FLASH_ALPHA. */
  strength: number;
};

const MIN_FLICKER_GAP_MS = 360;

/**
 * Purple lightning for an Epic: a handful of flickers. Their starts are at least 360 ms apart, so
 * no one-second stretch holds more than three.
 */
export function lightningSchedule(random: () => number = Math.random, count = 5): Flicker[] {
  const out: Flicker[] = [];
  let at = 60;
  for (let i = 0; i < count; i++) {
    out.push({
      at: Math.round(at),
      durationMs: 150 + Math.round(random() * 90),
      strength: Math.round((0.22 + random() * (MAX_FLASH_ALPHA - 0.22)) * 100) / 100,
    });
    at += MIN_FLICKER_GAP_MS + 20 + random() * 160;
  }
  return out;
}

/**
 * The Legendary blackout: the screen dims to black (not instantly), holds for a beat, then the
 * gold comes up slowly. The dim and the return both take real time, so there is no hard cut.
 */
export const BLACKOUT = { fadeInMs: 280, holdMs: 520, fadeOutMs: 900 } as const;

/** The slow-motion gold explosion runs at this fraction of normal speed. */
export const SLOW_MOTION = 0.38;

/** Screen shake for an Epic: small, short, and dying away. Pixels of sideways travel per swing. */
export function shakeSwings(): number[] {
  return [5, -5, 4, -4, 3, -3, 2, -2, 1, -1, 0];
}
