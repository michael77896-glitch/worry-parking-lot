import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { Car, CAR_ASPECT } from '@/components/lot/car';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** The painted number, 1 and up. */
  number: number;
  width: number;
  /** A car sitting in the spot. It settles in gently when the spot first appears. */
  car?: { color: string; lit?: boolean };
  /** Replaces the default car, for screens that animate it themselves. */
  slot?: ReactNode;
  selected?: boolean;
  /** Delay before the car settles in, to stagger several spots. */
  enterDelay?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/** One painted parking space: three white lines on asphalt, with a car in it or not. */
export function ParkingSpot({
  number,
  width,
  car,
  slot,
  selected = false,
  enterDelay = 0,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const theme = useTheme();
  const height = width * 1.5;
  const carWidth = width * 0.6;

  const content = (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 100 150" style={StyleSheet.absoluteFill}>
        {selected && (
          <Rect x="2" y="2" width="96" height="146" rx="10" fill={theme.backgroundSelected} />
        )}
        <Path
          d="M9 148 L9 8 L91 8 L91 148"
          fill="none"
          stroke={selected ? theme.accent : theme.paint}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {(slot || car) && (
        <View style={[styles.carSlot, { top: height * 0.1, width, height: carWidth * CAR_ASPECT }]}>
          {slot ?? (
            <Animated.View
              entering={FadeInDown.duration(800)
                .delay(enterDelay)
                .easing(Easing.out(Easing.cubic))
                .reduceMotion(ReduceMotion.System)}>
              <Car color={car!.color} width={carWidth} lit={car!.lit} />
            </Animated.View>
          )}
        </View>
      )}

      <View style={styles.number} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ThemedText type="caption" themeColor="textSecondary">
          {number}
        </ThemedText>
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={!accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carSlot: { position: 'absolute', alignItems: 'center' },
  number: { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  pressed: { opacity: 0.8 },
});
