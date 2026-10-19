import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import type { BoxType } from '@/constants/rewards';

const LOOK: Record<BoxType, { body: string; lid: string; trim: string; latch: string }> = {
  glovebox: { body: '#2F384B', lid: '#3B4762', trim: '#7F8AA3', latch: '#C9D0DC' },
  toolbox: { body: '#2E6F7A', lid: '#3A8793', trim: '#1F4A52', latch: '#E3E8EF' },
  golden: { body: '#B88A2E', lid: '#D9A83F', trim: '#8A6420', latch: '#FFF1C2' },
};

type Props = {
  type: BoxType;
  width: number;
  /** Style for the lid, e.g. an animated style that lifts it when the box pops open. */
  lidStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  children?: ReactNode;
};

/**
 * A box drawn in two pieces, body and lid, so the lid can pop off. Decorative: screens label the
 * box in text.
 */
export function BoxArt({ type, width, lidStyle, children }: Props) {
  const look = LOOK[type];
  const lidH = width * 0.3;
  const bodyH = width * 0.5;

  return (
    <View
      style={{ width, height: lidH + bodyH }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={bodyH} style={[styles.body, { top: lidH }]} viewBox="0 0 100 50">
        <Rect x="2" y="0" width="96" height="48" rx="8" fill={look.body} />
        {type === 'golden' &&
          [25, 50, 75].map((x) => <Line key={x} x1={x} y1="3" x2={x} y2="45" stroke={look.trim} strokeWidth="2.5" />)}
        {type === 'toolbox' && <Rect x="10" y="12" width="80" height="4" rx="2" fill={look.trim} opacity="0.7" />}
        {type === 'glovebox' && <Rect x="12" y="14" width="76" height="4" rx="2" fill={look.trim} opacity="0.7" />}
        <Circle cx="50" cy="6" r="4.5" fill={look.latch} />
      </Svg>
      <Animated.View style={[styles.lid, { height: lidH }, lidStyle]}>
        <Svg width={width} height={lidH} viewBox="0 0 100 30">
          {type === 'toolbox' && (
            <Path d="M34 14 V6 Q34 2 38 2 H62 Q66 2 66 6 V14" fill="none" stroke={look.trim} strokeWidth="4" strokeLinecap="round" />
          )}
          <Rect x="0" y="12" width="100" height="18" rx="8" fill={look.lid} />
          <Rect x="6" y="16" width="88" height="3" rx="1.5" fill={look.trim} opacity="0.55" />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { position: 'absolute', left: 0 },
  lid: { position: 'absolute', left: 0, top: 0, width: '100%' },
});
