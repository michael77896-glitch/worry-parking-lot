import { Image } from 'expo-image';
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { getCar, getCarImage } from '@/constants/car-catalog';
import { Night } from '@/constants/theme';

/** The flat dark color a locked car is drawn in. */
const SILHOUETTE = '#0E1219';

type Props = {
  /** An id from the car catalog. */
  carId: string;
  /** With only a width, the car is drawn at its natural proportions. */
  width: number;
  /**
   * With a height too, the car is fitted into that box: as large as fits, never stretched,
   * nose at the top (like a car parked nose-in), and shorter cars a little smaller.
   */
  height?: number;
  /** A soft lamp glow behind the car, for when the gate is open and it can be visited. */
  lit?: boolean;
  /** Draw the car as a flat dark shape, for locked cars. */
  silhouette?: boolean;
  /** A paint from the catalog, if the car has it. */
  paintId?: string;
};

/** Decorative. Screens give the car an accessibility label through the thing that holds it. */
export function Car({ carId, width, height, lit = false, silhouette = false, paintId }: Props) {
  const gradientId = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const car = getCar(carId);

  // In a box, the car fits inside the width too, so a wide car never pokes out of its spot.
  const fitted = height === undefined ? null : Math.min(height * car.length, width / car.aspect);
  const boxHeight = height ?? width / car.aspect;
  const carHeight = fitted ?? boxHeight;
  const carWidth = height === undefined ? width : carHeight * car.aspect;

  return (
    <View
      style={{ width, height: boxHeight, alignItems: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {lit && (
        <Svg
          style={{ position: 'absolute', left: (width - carWidth * 1.9) / 2, top: -carHeight * 0.12 }}
          width={carWidth * 1.9}
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
        source={getCarImage(car, paintId)}
        style={{ width: carWidth, height: carHeight }}
        contentFit="contain"
        contentPosition="top"
        tintColor={silhouette ? SILHOUETTE : undefined}
        transition={0}
      />
    </View>
  );
}
