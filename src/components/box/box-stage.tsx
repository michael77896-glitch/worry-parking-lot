import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Image,
  LinearGradient,
  Oval,
  Path,
  Points,
  RadialGradient,
  Rect,
  rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { BOX_PHOTOS } from '@/constants/box-photos';
import type { BoxType } from '@/constants/rewards';

/** Height of the box the stage draws, in points. */
export const BOX_DRAW_H = 170;
const SPARKS = 22;

/** A small repeatable random generator, so the sparks and rays are the same every time. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SceneProps = {
  width: number;
  height: number;
  color: string;
  /** Seconds, ticking on the UI thread. Frozen at 0 when motion is reduced. */
  clock: SharedValue<number>;
  /** 0 to 1: how charged the box is. Brightens the rays and the glow. */
  glow: SharedValue<number>;
};

/**
 * The garage at night: a dark floor, a spotlight on the box, slowly turning rays of the box's
 * color, and a pulsing glow behind it. Drawn inside a Skia Canvas (twice: once under the reel, once
 * over it as the cover, so the two match exactly).
 */
export function StageScenery({ width, height, color, clock, glow }: SceneProps) {
  const cx = width / 2;
  const cy = height * 0.5;
  const floorY = cy + BOX_DRAW_H / 2 + 8;

  const rays = useMemo(() => {
    const radius = height * 1.3;
    const half = 0.085;
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      d += `M ${cx} ${cy} L ${cx + radius * Math.cos(a - half)} ${cy + radius * Math.sin(a - half)} L ${
        cx + radius * Math.cos(a + half)
      } ${cy + radius * Math.sin(a + half)} Z `;
    }
    return d;
  }, [cx, cy, height]);

  const lines = useMemo(
    () =>
      `M ${cx - 150} ${floorY + 8} L ${cx - 215} ${height} M ${cx + 150} ${floorY + 8} L ${cx + 215} ${height} M ${
        cx - 150
      } ${floorY + 8} L ${cx + 150} ${floorY + 8}`,
    [cx, floorY, height],
  );

  const spotlight = useMemo(
    () => `M ${cx - 16} 0 L ${cx + 16} 0 L ${cx + 130} ${floorY} L ${cx - 130} ${floorY} Z`,
    [cx, floorY],
  );

  const rayTransform = useDerivedValue(() => [{ rotate: clock.get() * 0.16 }]);
  const rayOpacity = useDerivedValue(() => 0.5 + glow.get() * 0.5);
  const glowR = useDerivedValue(() => 96 + (0.5 + 0.5 * Math.sin(clock.get() * 2.2)) * 12 + glow.get() * 70);

  return (
    <>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={['#080B11', '#131925', '#0C1017']} positions={[0, 0.62, 1]} />
      </Rect>
      <Path path={lines} style="stroke" strokeWidth={3} color="#FFFFFF" opacity={0.07} />
      <Path path={spotlight}>
        <LinearGradient start={vec(cx, 0)} end={vec(cx, floorY)} colors={['#FFFFFF2E', '#FFFFFF08']} />
      </Path>
      <Oval x={cx - 150} y={floorY - 22} width={300} height={44}>
        <RadialGradient c={vec(cx, floorY)} r={150} colors={['#FFFFFF38', '#FFFFFF00']} />
      </Oval>
      <Group transform={rayTransform} origin={vec(cx, cy)} opacity={rayOpacity}>
        <Path path={rays}>
          <RadialGradient c={vec(cx, cy)} r={height * 0.85} colors={[`${color}70`, `${color}00`]} />
        </Path>
      </Group>
      <Circle cx={cx} cy={cy} r={glowR}>
        <RadialGradient c={vec(cx, cy)} r={glowR} colors={[`${color}8C`, `${color}00`]} />
      </Circle>
    </>
  );
}

/** The scenery on its own canvas, for under the reel. */
export function SceneryCanvas(props: SceneProps) {
  return (
    <Canvas style={{ width: props.width, height: props.height }}>
      <StageScenery {...props} />
    </Canvas>
  );
}

type BoxProps = SceneProps & {
  type: BoxType;
  /** 0 to 1: the lid blasting off, the beam of light, and the glow after it. */
  blast: SharedValue<number>;
  /** Extra sideways offset in points, for the rattle of a hard press. */
  shake: SharedValue<number>;
};

/**
 * The box on its stage. It floats and glows; as `glow` (the charge) rises it rattles harder, light
 * leaks out of the seam, and sparks fly off. When `blast` goes from 0 to 1 the lid flies off under
 * a bright beam. Decorative: the screen puts the meaning in text.
 */
export function BoxStage({ type, width, height, color, clock, glow, blast, shake }: BoxProps) {
  const photo = BOX_PHOTOS[type];
  const image = useImage(photo.image);

  const cx = width / 2;
  const cy = height * 0.5;
  const bh = BOX_DRAW_H;
  const bw = bh * photo.aspect;
  const left = cx - bw / 2;
  const top = cy - bh / 2;
  const seamY = top + bh * photo.seam;

  const sparkSeeds = useMemo(() => {
    const random = seeded(7);
    return Array.from({ length: SPARKS }, () => ({
      x: (random() - 0.5) * 0.8,
      vx: (random() - 0.5) * 210,
      vy: -(70 + random() * 170),
      rate: 0.9 + random() * 0.9,
      offset: random(),
    }));
  }, []);

  const boxTransform = useDerivedValue(() => {
    const c = glow.get();
    const t = clock.get();
    const rattle = Math.sin(t * 75) * c * c * 6 + Math.sin(t * 113) * c * 3;
    return [
      { translateX: shake.get() + rattle },
      { translateY: Math.sin(t * 1.6) * 5 * (1 - c) + Math.cos(t * 90) * c * 2 },
      { scale: 1 + c * 0.07 },
    ];
  });
  const lidTransform = useDerivedValue(() => {
    const b = blast.get();
    return [{ translateY: -b * 90 }, { translateX: b * 24 }, { rotate: -b * 0.5 }];
  });
  const lidOpacity = useDerivedValue(() => 1 - Math.min(1, Math.max(0, (blast.get() - 0.35) / 0.5)));
  const leakOpacity = useDerivedValue(() => glow.get() * (0.9 + 0.1 * Math.sin(clock.get() * 40)));
  const leakWideOpacity = useDerivedValue(() => glow.get() * 0.75);
  const sparks = useDerivedValue(() => {
    const t = clock.get();
    const active = Math.floor(Math.min(1, glow.get()) * SPARKS);
    return sparkSeeds.map((s, i) => {
      if (i >= active) return { x: -60, y: -60 };
      const sec = ((t * s.rate + s.offset) % 1) * 0.8;
      return { x: cx + s.x * bw + s.vx * sec, y: seamY + s.vy * sec + 320 * sec * sec };
    });
  });
  const beamOpacity = useDerivedValue(() => {
    const b = blast.get();
    return Math.min(1, b * 5) * (1 - Math.min(1, Math.max(0, (b - 0.5) / 0.5)));
  });
  const beamWidth = useDerivedValue(() => 26 + blast.get() * 80);
  const beamX = useDerivedValue(() => cx - (26 + blast.get() * 80) / 2);
  const shockR = useDerivedValue(() => 30 + blast.get() * 170);

  return (
    <Canvas style={{ width, height }}>
      <StageScenery width={width} height={height} color={color} clock={clock} glow={glow} />

      <Group transform={boxTransform} origin={vec(cx, cy)}>
        <Group transform={lidTransform} origin={vec(cx, seamY)} opacity={lidOpacity}>
          <Group clip={rect(left, top - 4, bw, seamY - top + 4)}>
            {image && <Image image={image} x={left} y={top} width={bw} height={bh} fit="contain" />}
          </Group>
        </Group>
        <Group clip={rect(left, seamY, bw, top + bh - seamY + 6)}>
          {image && <Image image={image} x={left} y={top} width={bw} height={bh} fit="contain" />}
        </Group>
        <Group opacity={leakWideOpacity}>
          <Rect x={left + bw * 0.05} y={seamY - 6} width={bw * 0.9} height={12} color={color}>
            <BlurMask blur={14} style="normal" />
          </Rect>
        </Group>
        <Group opacity={leakOpacity}>
          <Rect x={left + bw * 0.07} y={seamY - 2} width={bw * 0.86} height={4} color="#FFF3C4">
            <BlurMask blur={5} style="normal" />
          </Rect>
        </Group>
      </Group>

      <Points points={sparks} mode="points" color="#FFE9A8" strokeWidth={3.5} strokeCap="round" />

      <Group opacity={beamOpacity}>
        <Rect x={beamX} y={-30} width={beamWidth} height={seamY + 30}>
          <LinearGradient start={vec(cx, seamY)} end={vec(cx, 0)} colors={['#FFFFFF', `${color}B3`, `${color}00`]} />
          <BlurMask blur={10} style="normal" />
        </Rect>
        <Circle cx={cx} cy={seamY} r={shockR}>
          <RadialGradient c={vec(cx, seamY)} r={shockR} colors={['#FFFFFF66', `${color}59`, `${color}00`]} />
        </Circle>
      </Group>
    </Canvas>
  );
}
