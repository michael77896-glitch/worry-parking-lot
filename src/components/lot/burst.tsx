import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Particle = {
  angle: number;
  distance: number;
  size: number;
  /** 0 to 0.2: how late the particle sets off. */
  delay: number;
  diamond: boolean;
  spin: number;
  light: boolean;
};

function makeParticles(gold: boolean): Particle[] {
  const count = gold ? 46 : 22;
  return Array.from({ length: count }, (_, i) => {
    const sparkle = gold && i % 3 === 0;
    return {
      angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      distance: (gold ? 90 : 70) + Math.random() * (gold ? 170 : 110),
      size: sparkle ? 9 + Math.random() * 6 : 5 + Math.random() * 5,
      delay: Math.random() * 0.18,
      diamond: sparkle,
      spin: (Math.random() - 0.5) * 3,
      light: sparkle || Math.random() < 0.25,
    };
  });
}

function Dot({ p, progress, color }: { p: Particle; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.value - p.delay) / (1 - p.delay)));
    const out = 1 - (1 - t) * (1 - t); // fast out, slow settle
    return {
      opacity: t === 0 ? 0 : 1 - t * t,
      transform: [
        { translateX: Math.cos(p.angle) * p.distance * out },
        { translateY: Math.sin(p.angle) * p.distance * out + 46 * t * t },
        { rotate: `${(p.diamond ? Math.PI / 4 : 0) + p.spin * t}rad` },
        { scale: 1 - 0.45 * t },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: p.size,
          height: p.size,
          marginLeft: -p.size / 2,
          marginTop: -p.size / 2,
          borderRadius: p.diamond ? 2 : p.size / 2,
          backgroundColor: p.light ? '#FFF6D6' : color,
        },
        style,
      ]}
    />
  );
}

/**
 * A burst of particles from the center of its parent, in the rarity's color. Gold bursts have more
 * particles, some of them glinting diamonds. It plays once each time `trigger` changes to a new
 * positive number, and stays out of the way of touches. Decorative.
 */
export function ParticleBurst({ color, gold, trigger }: { color: string; gold: boolean; trigger: number }) {
  const progress = useSharedValue(0);
  const [particles] = useState(() => makeParticles(gold));

  useEffect(() => {
    if (trigger <= 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: gold ? 1500 : 950, easing: Easing.out(Easing.quad) });
  }, [trigger, gold, progress]);

  return (
    <View
      pointerEvents="none"
      style={styles.center}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => (
        <Dot key={i} p={p} progress={progress} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
  dot: { position: 'absolute', left: 0, top: 0, opacity: 0 },
});
