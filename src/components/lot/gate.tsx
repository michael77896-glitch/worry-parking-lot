import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { Night } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const HEIGHT = 168;
const POST_W = 26;
const POST_H = 56;
const ARM_H = 14;
const ARM_W = 132;
const OPEN_ANGLE = -52;
// The barrier hinges on the top of the post.
const HINGE_X = 8 + POST_W / 2;
const HINGE_Y = HEIGHT - POST_H - ARM_H / 2;

type Props = {
  open: boolean;
  /** Full width of the illustration. */
  width: number;
};

/**
 * The gate barrier. When the worry window opens it lifts slowly; when it closes it lowers.
 * The status is also written out by the screen, so this is never the only signal.
 */
export function Gate({ open, width }: Props) {
  const theme = useTheme();
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = withDelay(
      300,
      withTiming(open ? OPEN_ANGLE : 0, {
        duration: 1300,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [open, angle]);

  const armStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -ARM_W / 2 }, { rotate: `${angle.value}deg` }, { translateX: ARM_W / 2 }],
  }));

  return (
    <View
      style={{ width, height: HEIGHT }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {/* the ground, with a dashed lane line */}
      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Line x1="0" y1={HEIGHT - 2} x2={width} y2={HEIGHT - 2} stroke={theme.paint} strokeWidth="2" />
        <Line
          x1={POST_W + 24}
          y1={HEIGHT - 20}
          x2={width - 8}
          y2={HEIGHT - 20}
          stroke={theme.paint}
          strokeWidth="3"
          strokeDasharray="14 12"
          strokeLinecap="round"
        />
      </Svg>

      {/* the post, with its lamp */}
      <View style={[styles.post, { backgroundColor: theme.gatePost, borderColor: theme.border }]}>
        <View
          style={[
            styles.lamp,
            open
              ? { backgroundColor: theme.accent, shadowColor: Night.accent, shadowOpacity: 0.9, shadowRadius: 8 }
              : { backgroundColor: theme.backgroundSelected, borderColor: theme.paint, borderWidth: 1.5 },
          ]}
        />
      </View>

      {/* the barrier arm */}
      <Animated.View style={[styles.arm, { left: HINGE_X, top: HINGE_Y - ARM_H / 2 }, armStyle]}>
        <Svg width={ARM_W} height={ARM_H}>
          {Array.from({ length: Math.ceil(ARM_W / 22) }).map((_, i) => (
            <Rect
              key={i}
              x={i * 22}
              y="0"
              width="22"
              height={ARM_H}
              fill={i % 2 === 0 ? theme.ticket : '#D9A862'}
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    position: 'absolute',
    left: 8,
    bottom: 2,
    width: POST_W,
    height: POST_H,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 9,
  },
  lamp: { width: 11, height: 11, borderRadius: 6 },
  arm: {
    position: 'absolute',
    width: ARM_W,
    height: ARM_H,
    borderRadius: ARM_H / 2,
    overflow: 'hidden',
  },
});
