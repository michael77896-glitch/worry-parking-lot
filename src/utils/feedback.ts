import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import type { Rarity } from '@/constants/rarity';

/**
 * Haptics and sound for opening boxes. Nothing here can throw: a phone without haptics, or with
 * the sound system busy, just gets a quiet opening. Sounds respect the iPhone's silent switch
 * and mix with the user's own music rather than stopping it.
 */

// --- Haptics --------------------------------------------------------------------------------

function safe(run: () => Promise<unknown>): void {
  run().catch(() => {});
}

/** One light tap, for each card that passes the marker. */
export function tickHaptic(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Gets firmer as `level` goes from 0 to 1, while the box shakes. */
export function shakeHaptic(level: number): void {
  const style =
    level < 0.4
      ? Haptics.ImpactFeedbackStyle.Light
      : level < 0.8
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
  safe(() => Haptics.impactAsync(style));
}

/** One buzz while a box is charging. The caller makes them come faster and firmer as it fills. */
export function buzz(strength: 'light' | 'medium' | 'heavy'): void {
  const style =
    strength === 'light'
      ? Haptics.ImpactFeedbackStyle.Light
      : strength === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
  safe(() => Haptics.impactAsync(style));
}

/** The box bursting open: one strong thump. */
export function burstHaptic(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  setTimeout(() => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 90);
}

/** The reel stopping on the reward. Longer and stronger the rarer it is; gold is the longest. */
export function landHaptic(rarity: Rarity | 'golden'): void {
  if (rarity === 'common') return;
  if (rarity === 'rare') return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  if (rarity === 'epic') {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), 120);
    return;
  }
  // Legendary and Golden Crate: a slow rolling pulse that fades out.
  [0, 130, 270, 430, 620].forEach((at, i) =>
    setTimeout(
      () =>
        safe(() =>
          Haptics.impactAsync(i < 3 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium),
        ),
      at,
    ),
  );
  setTimeout(() => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 760);
}

// --- Sound ----------------------------------------------------------------------------------

const SOURCES = {
  tick: require('../../assets/sounds/tick.wav'),
  open: require('../../assets/sounds/open.wav'),
  'reveal-common': require('../../assets/sounds/reveal-common.wav'),
  'reveal-rare': require('../../assets/sounds/reveal-rare.wav'),
  'reveal-epic': require('../../assets/sounds/reveal-epic.wav'),
  'reveal-legendary': require('../../assets/sounds/reveal-legendary.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

/** The reveal sound for a rarity. A Golden Crate sounds like Legendary. */
export function revealSfx(rarity: Rarity | 'golden'): Sfx {
  return rarity === 'golden' ? 'reveal-legendary' : (`reveal-${rarity}` as Sfx);
}

let audioModeSet = false;

async function setUpAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: false, // the silent switch silences the app
      interruptionMode: 'mixWithOthers', // don't stop the user's music
      shouldPlayInBackground: false,
    });
  } catch {
    // Keep going with the defaults.
  }
}

const TICK_POOL = 3;

/**
 * Loads the box sounds. Call `play` for each effect and `release` when the screen closes.
 * Ticks come fast, so they rotate through a few players instead of cutting each other off.
 */
export function createSfx() {
  const players: Partial<Record<Sfx, AudioPlayer | AudioPlayer[]>> = {};
  let nextTick = 0;
  let released = false;

  void setUpAudioMode().then(() => {
    if (released) return;
    try {
      for (const name of Object.keys(SOURCES) as Sfx[]) {
        players[name] =
          name === 'tick'
            ? Array.from({ length: TICK_POOL }, () => createAudioPlayer(SOURCES.tick))
            : createAudioPlayer(SOURCES[name]);
      }
    } catch {
      // No sound on this device.
    }
  });

  return {
    /**
     * Plays every sound silently for a moment. The first time a sound plays, iOS sets up its
     * audio engine, which can freeze the screen for a fifth of a second. Doing that while the box
     * is still shaking means it can't happen in the middle of the spin.
     */
    warmUp() {
      try {
        const all = Object.values(players)
          .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
          .filter((p): p is AudioPlayer => !!p);
        for (const p of all) {
          p.volume = 0;
          p.play();
        }
        setTimeout(() => {
          for (const p of all) {
            try {
              p.pause();
              void p.seekTo(0);
              p.volume = 1;
            } catch {
              // Ignore: this player is already gone.
            }
          }
        }, 90);
      } catch {
        // Ignore: a missed warm-up just means the first sound may be a little late.
      }
    },
    play(name: Sfx) {
      try {
        const entry = players[name];
        if (!entry) return;
        const player = Array.isArray(entry) ? entry[nextTick++ % entry.length] : entry;
        void player.seekTo(0);
        player.play();
      } catch {
        // Ignore: a missed sound is fine.
      }
    },
    release() {
      released = true;
      for (const entry of Object.values(players)) {
        for (const player of Array.isArray(entry) ? entry : [entry]) {
          try {
            player?.remove();
          } catch {
            // Already gone.
          }
        }
      }
    },
  };
}
