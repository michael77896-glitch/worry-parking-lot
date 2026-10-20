import { BlurMask, Canvas, Group, Path, Rect } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { MAX_FLASH_ALPHA, type Flicker } from '@/utils/box-effects';

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A jagged bolt from the top of the screen, as an SVG path string. */
function bolt(random: () => number, x0: number, height: number): string {
  let x = x0;
  let y = -10;
  let d = `M ${x} ${y}`;
  while (y < height) {
    y += 26 + random() * 38;
    x += (random() - 0.5) * 64;
    d += ` L ${x} ${y}`;
  }
  return d;
}

type Props = {
  width: number;
  height: number;
  flickers: Flicker[];
  /** The flicker plays each time this changes to a new positive number. */
  trigger: number;
};

/**
 * Purple lightning that flickers across the screen for an Epic. Each flicker fades in and out
 * (never a hard cut), the schedule never has more than three in a second, and the light behind the
 * bolts is capped (see `lightningSchedule`). Decorative.
 */
export function LightningLayer({ width, height, flickers, trigger }: Props) {
  const level = useSharedValue(0);
  const bolts = useMemo(() => {
    const random = seeded(99);
    return Array.from({ length: 4 }, (_, i) => bolt(random, width * (0.14 + 0.24 * i + random() * 0.08), height));
  }, [width, height]);

  useEffect(() => {
    if (trigger <= 0 || flickers.length === 0) return;
    cancelAnimation(level);
    level.set(
      withSequence(
        ...flickers.map((f, i) => {
          const waited = i === 0 ? f.at : f.at - (flickers[i - 1].at + flickers[i - 1].durationMs);
          return withDelay(
            Math.max(0, waited),
            withSequence(withTiming(f.strength, { duration: 50 }), withTiming(0, { duration: f.durationMs - 50 })),
          );
        }),
      ),
    );
  }, [trigger, flickers, level]);

  // Each flicker uses a different bolt.
  const which = useSharedValue(0);
  useAnimatedReaction(
    () => level.get() > 0.02,
    (on, was) => {
      if (on && !was) which.set((which.get() + 1) % 4);
    },
  );
  const wash = useDerivedValue(() => level.get() * 0.5);
  const o0 = useDerivedValue(() => (which.get() === 0 ? Math.min(1, (level.get() / MAX_FLASH_ALPHA) * 1.2) : 0));
  const o1 = useDerivedValue(() => (which.get() === 1 ? Math.min(1, (level.get() / MAX_FLASH_ALPHA) * 1.2) : 0));
  const o2 = useDerivedValue(() => (which.get() === 2 ? Math.min(1, (level.get() / MAX_FLASH_ALPHA) * 1.2) : 0));
  const o3 = useDerivedValue(() => (which.get() === 3 ? Math.min(1, (level.get() / MAX_FLASH_ALPHA) * 1.2) : 0));
  const opacities = [o0, o1, o2, o3];

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color="#8B5CF6" opacity={wash} />
      {bolts.map((d, i) => (
        <Group key={i} opacity={opacities[i]}>
          <Path path={d} style="stroke" strokeWidth={6} color="#B58CF5" strokeJoin="round">
            <BlurMask blur={10} style="normal" />
          </Path>
          <Path path={d} style="stroke" strokeWidth={2.5} color="#EBDDFF" strokeJoin="round" />
        </Group>
      ))}
    </Canvas>
  );
}
