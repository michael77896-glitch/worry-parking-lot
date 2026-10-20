import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * A soft band of light that sweeps across its children twice, when they appear. Used on the
 * reward's name and rarity. With Reduce Motion nothing sweeps.
 */
export function Shimmer({
  children,
  style,
  delayMs = 350,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delayMs?: number;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(-1);
  const width = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.set(withDelay(delayMs, withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }), 2, false)));
  }, [reduced, delayMs, progress]);

  const band = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.get() + 1) * 0.5 * (width.get() + 160) - 80 }, { skewX: '-18deg' }],
  }));

  return (
    <View style={[style, styles.clip]} onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      {children}
      {!reduced && (
        <Animated.View pointerEvents="none" style={[styles.band, band]}>
          <LinearGradient
            colors={['#FFFFFF00', '#FFFFFF52', '#FFFFFF00']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 80 },
});
