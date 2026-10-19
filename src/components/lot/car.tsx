import { Image } from 'expo-image';
import { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  FeColorMatrix,
  Filter,
  Image as SvgImage,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { getCar, getCarImage } from '@/constants/car-catalog';
import { getPaint, paintMatrix, STOCK_PAINT } from '@/constants/paints';
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
  /** A paint id from src/constants/paints.ts. Left out (or "stock"), the car keeps its own paint. */
  paintId?: string;
};

/**
 * A paint job: the car's picture is turned into its brightness and tinted with the paint color
 * (an SVG color-matrix filter), so windows and tires stay dark and the body takes the paint.
 * Color-shift paints fade from one color to another, top to bottom.
 */
function PaintedImage({
  source,
  width,
  height,
  paintId,
  id,
}: {
  source: number;
  width: number;
  height: number;
  paintId: string;
  id: string;
}) {
  const paint = getPaint(paintId);
  if (!paint) return <Image source={source} style={{ width, height }} contentFit="contain" contentPosition="top" transition={0} />;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <Filter id={`${id}a`} x="0%" y="0%" width="100%" height="100%">
          <FeColorMatrix type="matrix" values={paintMatrix(paint.finish, paint.color)} />
        </Filter>
        {paint.color2 && (
          <>
            <Filter id={`${id}b`} x="0%" y="0%" width="100%" height="100%">
              <FeColorMatrix type="matrix" values={paintMatrix(paint.finish, paint.color2)} />
            </Filter>
            <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.25" stopColor="#000000" />
              <Stop offset="0.8" stopColor="#ffffff" />
            </LinearGradient>
            <Mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
              <Rect x="0" y="0" width={width} height={height} fill={`url(#${id}g)`} />
            </Mask>
          </>
        )}
      </Defs>
      <SvgImage
        href={source}
        x="0"
        y="0"
        width={width}
        height={height}
        preserveAspectRatio="xMidYMin meet"
        filter={`url(#${id}a)`}
      />
      {paint.color2 && (
        <SvgImage
          href={source}
          x="0"
          y="0"
          width={width}
          height={height}
          preserveAspectRatio="xMidYMin meet"
          filter={`url(#${id}b)`}
          mask={`url(#${id}m)`}
        />
      )}
    </Svg>
  );
}

/** Decorative. Screens give the car an accessibility label through the thing that holds it. */
export function Car({ carId, width, height, lit = false, silhouette = false, paintId }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const car = getCar(carId);

  // In a box, the car fits inside the width too, so a wide car never pokes out of its spot.
  const fitted = height === undefined ? null : Math.min(height * car.length, width / car.aspect);
  const boxHeight = height ?? width / car.aspect;
  const carHeight = fitted ?? boxHeight;
  const carWidth = height === undefined ? width : carHeight * car.aspect;
  const painted = !silhouette && !!paintId && paintId !== STOCK_PAINT;
  const source = getCarImage(car, paintId);

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
            <RadialGradient id={`glow${uid}`} cx="50" cy="50" rx="50" ry="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={Night.accent} stopOpacity="0.38" />
              <Stop offset="1" stopColor={Night.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#glow${uid})`} />
        </Svg>
      )}
      {painted ? (
        <PaintedImage source={source} width={carWidth} height={carHeight} paintId={paintId!} id={`p${uid}`} />
      ) : (
        <Image
          source={source}
          style={{ width: carWidth, height: carHeight }}
          contentFit="contain"
          contentPosition="top"
          tintColor={silhouette ? SILHOUETTE : undefined}
          transition={0}
        />
      )}
    </View>
  );
}
