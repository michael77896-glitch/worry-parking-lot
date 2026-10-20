import {
  Canvas,
  Circle,
  Group,
  Image,
  Path,
  RadialGradient,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { getCar } from '@/constants/car-catalog';

type Props = {
  carId: string;
  /** The rarity's color, for the glow and the rings. */
  color: string;
  size: number;
};

/**
 * The car on a lit turntable, seen from above. It turns slowly and flashes its headlights twice
 * when it arrives. With Reduce Motion it just sits there, lights on. Decorative: the screen names
 * the car in text.
 */
export function Turntable({ carId, color, size }: Props) {
  const car = getCar(carId);
  const image = useImage(car.image);
  const reduced = useReducedMotion();
  const angle = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    angle.set(withRepeat(withTiming(Math.PI * 2, { duration: 14000, easing: Easing.linear }), -1, false));
    // Two flashes, a third of a second apart.
    flash.set(
      withDelay(
        450,
        withSequence(
          withTiming(1, { duration: 110 }),
          withTiming(0, { duration: 200 }),
          withTiming(1, { duration: 110 }),
          withTiming(0, { duration: 450 }),
        ),
      ),
    );
  }, [reduced, angle, flash]);

  const c = size / 2;
  const ch = size * 0.7 * car.length;
  const cw = ch * car.aspect;
  const lightY = c - ch / 2 + ch * 0.06;
  const lightDX = cw * 0.27;

  const ticks = useMemo(() => {
    let d = '';
    const r1 = size * 0.4;
    const r2 = size * 0.435;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      d += `M ${c + r1 * Math.cos(a)} ${c + r1 * Math.sin(a)} L ${c + r2 * Math.cos(a)} ${c + r2 * Math.sin(a)} `;
    }
    return d;
  }, [size, c]);

  const carTransform = useDerivedValue(() => [{ rotate: angle.get() }]);
  const ringTransform = useDerivedValue(() => [{ rotate: -angle.get() * 0.6 }]);
  const lightR = useDerivedValue(() => 9 + flash.get() * 22);
  const lightOpacity = useDerivedValue(() => 0.3 + flash.get() * 0.7);
  const beamOpacity = useDerivedValue(() => 0.08 + flash.get() * 0.4);
  const leftBeam = `M ${c - lightDX} ${lightY} L ${c - lightDX - 34} ${lightY - ch * 0.55} L ${c - lightDX + 30} ${lightY - ch * 0.55} Z`;
  const rightBeam = `M ${c + lightDX} ${lightY} L ${c + lightDX - 30} ${lightY - ch * 0.55} L ${c + lightDX + 34} ${lightY - ch * 0.55} Z`;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={c} cy={c} r={size * 0.5}>
        <RadialGradient c={vec(c, c)} r={size * 0.5} colors={[`${color}59`, `${color}00`]} />
      </Circle>
      <Circle cx={c} cy={c} r={size * 0.38}>
        <RadialGradient c={vec(c, c)} r={size * 0.38} colors={['#222B3C', '#0E121B']} />
      </Circle>
      <Circle cx={c} cy={c} r={size * 0.385} style="stroke" strokeWidth={3} color={color} opacity={0.85} />
      <Circle cx={c} cy={c} r={size * 0.3} style="stroke" strokeWidth={1} color={color} opacity={0.3} />
      <Group transform={ringTransform} origin={vec(c, c)}>
        <Path path={ticks} style="stroke" strokeWidth={2} color={color} opacity={0.55} />
      </Group>
      <Group transform={carTransform} origin={vec(c, c)}>
        <Group opacity={beamOpacity}>
          <Path path={leftBeam} color="#FFF4C2" />
          <Path path={rightBeam} color="#FFF4C2" />
        </Group>
        {image && <Image image={image} x={c - cw / 2} y={c - ch / 2} width={cw} height={ch} fit="contain" />}
        <Group opacity={lightOpacity}>
          {[-lightDX, lightDX].map((dx) => (
            <Circle key={dx} cx={c + dx} cy={lightY} r={lightR}>
              <RadialGradient c={vec(c + dx, lightY)} r={lightR} colors={['#FFFFFF', '#FFF2B0CC', '#FFF2B000']} />
            </Circle>
          ))}
        </Group>
      </Group>
    </Canvas>
  );
}
