import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Night } from '@/constants/theme';

// The car is drawn in a 60 x 110 box, seen from above, nose up. The viewBox leaves
// room around it so the soft lamp glow isn't clipped.
const PAD_X = 20;
const PAD_Y = 14;

type Props = {
  color: string;
  /** Body width in points. Height follows. */
  width: number;
  /** A soft lamp glow behind the car, for when the gate is open and it can be visited. */
  lit?: boolean;
};

/** Decorative. Screens give the car an accessibility label through the thing that holds it. */
export function Car({ color, width, lit = false }: Props) {
  const gradientId = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const scale = width / 60;
  const height = 110 * scale;

  return (
    <View
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg
        style={{ position: 'absolute', left: -PAD_X * scale, top: -PAD_Y * scale }}
        width={(60 + PAD_X * 2) * scale}
        height={(110 + PAD_Y * 2) * scale}
        viewBox={`${-PAD_X} ${-PAD_Y} ${60 + PAD_X * 2} ${110 + PAD_Y * 2}`}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={Night.accent} stopOpacity="0.4" />
            <Stop offset="1" stopColor={Night.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {lit && <Ellipse cx="30" cy="55" rx="52" ry="68" fill={`url(#${gradientId})`} />}

        {/* mirrors */}
        <Rect x="1" y="34" width="8" height="9" rx="4" fill={color} />
        <Rect x="51" y="34" width="8" height="9" rx="4" fill={color} />
        {/* body */}
        <Rect x="5" y="3" width="50" height="104" rx="18" fill={color} />
        {/* cabin */}
        <Rect x="11" y="36" width="38" height="42" rx="11" fill="#0F1218" opacity="0.2" />
        {/* windscreen and rear window */}
        <Path d="M14 38 L46 38 L42 25 Q30 21 18 25 Z" fill="#0F1218" opacity="0.6" />
        <Path d="M16 76 L44 76 L41 88 Q30 91 19 88 Z" fill="#0F1218" opacity="0.6" />
        {/* headlights, and soft tail lights */}
        <Rect x="10" y="7" width="11" height="5" rx="2.5" fill="#FFF3D6" />
        <Rect x="39" y="7" width="11" height="5" rx="2.5" fill="#FFF3D6" />
        <Rect x="11" y="99" width="10" height="3.5" rx="1.75" fill="#B98780" />
        <Rect x="39" y="99" width="10" height="3.5" rx="1.75" fill="#B98780" />
      </Svg>
    </View>
  );
}

export const CAR_ASPECT = 110 / 60;
