import { Canvas, Circle, Group, Points, RadialGradient, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { MAX_FLASH_ALPHA, SLOW_MOTION } from '@/utils/box-effects';

const CONFETTI = 54;
const RAIN = 46;

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ConfettiSeed = { angle: number; speed: number; kind: number; spin: number };

/** Where one color group of the confetti is, `sec` seconds after the burst. */
function confettiAt(seeds: ConfettiSeed[], kind: number, sec: number, cx: number, cy: number) {
  'worklet';
  // The burst shoots out fast and drifts down under gravity.
  const out = 1 - Math.exp(-sec * 3.2);
  return seeds.map((c) => {
    if (c.kind !== kind) return { x: -80, y: -80 };
    return {
      x: cx + Math.cos(c.angle) * c.speed * out * 0.62 + Math.sin(sec * c.spin * 3) * 5,
      y: cy + Math.sin(c.angle) * c.speed * out * 0.62 + 190 * sec * sec,
    };
  });
}

type Props = {
  width: number;
  height: number;
  /** The rarity's color. */
  color: string;
  /** Legendary: the explosion runs in slow motion and gold rain falls. */
  gold: boolean;
  /** Plays once each time this changes to a new positive number. */
  trigger: number;
};

/**
 * The reveal: a shockwave ring and a burst of confetti in the rarity color from the center of the
 * reel. For gold, the same burst plays in slow motion (about a third of the speed), bigger, with
 * gold rain falling from the top. One pass, no looping. Decorative.
 */
export function RevealFx({ width, height, color, gold, trigger }: Props) {
  const t = useSharedValue(0);
  const cx = width / 2;
  const cy = height / 2;
  const seconds = gold ? 1.7 / SLOW_MOTION : 1.7;

  useEffect(() => {
    if (trigger <= 0) return;
    t.set(0);
    t.set(withTiming(1, { duration: seconds * 1000, easing: Easing.linear }));
  }, [trigger, seconds, t]);

  const seeds = useMemo(() => {
    const random = seeded(31);
    return {
      confetti: Array.from({ length: CONFETTI }, (_, i) => ({
        angle: (i / CONFETTI) * Math.PI * 2 + (random() - 0.5) * 0.6,
        speed: 150 + random() * 330,
        kind: i % 3, // 0 rarity color, 1 light, 2 white
        spin: random() * 6,
      })),
      rain: Array.from({ length: RAIN }, () => ({
        x: random(),
        offset: random(),
        speed: 0.55 + random() * 0.5,
        wobble: random() * 6,
      })),
    };
  }, []);

  // Confetti in three colors: the rarity color, a pale tint, and white.
  const slow = gold ? SLOW_MOTION : 1;
  const colorPoints = useDerivedValue(() => confettiAt(seeds.confetti, 0, t.get() * seconds * slow, cx, cy));
  const lightPoints = useDerivedValue(() => confettiAt(seeds.confetti, 1, t.get() * seconds * slow, cx, cy));
  const whitePoints = useDerivedValue(() => confettiAt(seeds.confetti, 2, t.get() * seconds * slow, cx, cy));

  const confettiOpacity = useDerivedValue(() => Math.max(0, 1 - Math.max(0, t.get() - 0.45) / 0.55));
  const ringR = useDerivedValue(() => 18 + Math.min(1, t.get() * (gold ? 2.2 : 3.4)) * Math.max(width, height) * 0.55);
  const ringOpacity = useDerivedValue(() => Math.max(0, 1 - Math.min(1, t.get() * (gold ? 2.2 : 3.4))) * 0.9);
  const ringWidth = useDerivedValue(() => 5 + (1 - Math.min(1, t.get() * 3)) * 9);
  const flareR = useDerivedValue(() => 40 + t.get() * 120);
  const flareOpacity = useDerivedValue(() => Math.max(0, 1 - t.get() * (gold ? 2.5 : 4)) * MAX_FLASH_ALPHA * 2);

  const rain = useDerivedValue(() => {
    const sec = t.get() * seconds * slow;
    return seeds.rain.map((r) => {
      if (!gold) return { x: -80, y: -80 };
      const y = ((sec * r.speed * 0.9 + r.offset) % 1) * (height + 40) - 20;
      return { x: r.x * width + Math.sin(sec * 2 + r.wobble) * 8, y };
    });
  });
  // Gold rain begins once the explosion has opened out, and stops as the animation ends.
  const rainOpacity = useDerivedValue(() => {
    const p = t.get();
    return Math.min(1, Math.max(0, (p - 0.12) / 0.2)) * (1 - Math.min(1, Math.max(0, (p - 0.85) / 0.15)));
  });

  const hot = gold ? '#FFE27A' : color;
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Circle cx={cx} cy={cy} r={flareR} opacity={flareOpacity}>
        <RadialGradient c={vec(cx, cy)} r={flareR} colors={[`${hot}FF`, `${hot}00`]} />
      </Circle>
      <Circle cx={cx} cy={cy} r={ringR} style="stroke" strokeWidth={ringWidth} color={hot} opacity={ringOpacity} />
      <Group opacity={confettiOpacity}>
        <Points points={colorPoints} mode="points" color={hot} strokeWidth={8} strokeCap="square" />
        <Points points={lightPoints} mode="points" color="#FFF6D6" strokeWidth={6} strokeCap="square" />
        <Points points={whitePoints} mode="points" color="#FFFFFF" strokeWidth={4} strokeCap="round" />
      </Group>
      <Group opacity={rainOpacity}>
        <Points points={rain} mode="points" color="#F6C945" strokeWidth={5} strokeCap="round" />
      </Group>
    </Canvas>
  );
}
