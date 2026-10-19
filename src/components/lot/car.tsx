import { Image } from 'expo-image';
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { Night } from '@/constants/theme';
import type { CarKind } from '@/data';

// Top-down pictures, nose up, trimmed to the car and sized for 3x screens.
const IMAGES: Record<CarKind, number> = {
  hatchback: require('../../../assets/cars/hatchback.png'),
  sedan: require('../../../assets/cars/sedan.png'),
  suv: require('../../../assets/cars/suv.png'),
  pickup: require('../../../assets/cars/pickup.png'),
  beetle: require('../../../assets/cars/beetle.png'),
  van: require('../../../assets/cars/van.png'),
};

/** Width divided by height of each trimmed picture. */
const ASPECT: Record<CarKind, number> = {
  hatchback: 260 / 480,
  sedan: 227 / 480,
  suv: 255 / 480,
  pickup: 231 / 480,
  beetle: 228 / 480,
  van: 238 / 480,
};

/** How long each car is next to the longest one, so a beetle really is shorter than a van. */
const LENGTH: Record<CarKind, number> = {
  hatchback: 0.9,
  sedan: 0.97,
  suv: 0.95,
  pickup: 1,
  beetle: 0.88,
  van: 1,
};

type Props = {
  kind: CarKind;
  /** With only a width, the car is drawn at its natural proportions. */
  width: number;
  /**
   * With a height too, the car is fitted into that box: as large as fits, never stretched,
   * nose at the top (like a car parked nose-in), and shorter cars a little shorter.
   */
  height?: number;
  /** A soft lamp glow behind the car, for when the gate is open and it can be visited. */
  lit?: boolean;
};

/** Decorative. Screens give the car an accessibility label through the thing that holds it. */
export function Car({ kind, width, height, lit = false }: Props) {
  const gradientId = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const boxHeight = height ?? width / ASPECT[kind];
  const carHeight = height === undefined ? boxHeight : boxHeight * LENGTH[kind];

  return (
    <View
      style={{ width, height: boxHeight }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {lit && (
        <Svg
          style={{ position: 'absolute', left: -width * 0.45, top: -carHeight * 0.12 }}
          width={width * 1.9}
          height={carHeight * 1.24}
          viewBox="0 0 100 100"
          preserveAspectRatio="none">
          <Defs>
            <RadialGradient id={gradientId} cx="50" cy="50" rx="50" ry="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={Night.accent} stopOpacity="0.38" />
              <Stop offset="1" stopColor={Night.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#${gradientId})`} />
        </Svg>
      )}
      <Image
        source={IMAGES[kind]}
        style={{ width, height: carHeight }}
        contentFit="contain"
        contentPosition="top"
        transition={0}
      />
    </View>
  );
}
