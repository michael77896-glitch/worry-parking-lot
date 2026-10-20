import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BoxArt } from '@/components/lot/box-art';
import { Car } from '@/components/lot/car';
import { PartTile } from '@/components/lot/part-tile';
import { getPaint } from '@/constants/paints';
import { getPart } from '@/constants/parts';
import { Spacing } from '@/constants/theme';
import type { Reward } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { describeReward } from '@/utils/rewards-ui';

/**
 * How long the spin lasts. With the winner 28 cards in (see REEL_WINNER_INDEX), that is about
 * 3,000 px, so it starts near 1,100 px per second (a bit over a tenth of a card per frame) and
 * slows evenly to a stop. Raise this for a longer, gentler spin.
 */
export const REEL_SPIN_MS = 5500;

export const CARD_W = 104;
export const CARD_H = 132;
const GAP = 8;
export const STRIDE = CARD_W + GAP;
const VERTICAL_PAD = 26;
const RADIUS = 16;
const BAR_H = 6;
/** The reel slides this far past the marker, then settles back. */
const OVERSHOOT = 14;

/** A round paint swatch from plain views (two-tone for color-shift), which are cheap to draw. */
function PaintDot({ paintId, size }: { paintId: string; size: number }) {
  const paint = getPaint(paintId);
  if (!paint) return null;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: paint.color }}>
      {paint.color2 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: size / 2,
            borderBottomLeftRadius: size / 2,
            borderBottomRightRadius: size / 2,
            backgroundColor: paint.color2,
          }}
        />
      )}
    </View>
  );
}

/**
 * One glossy card on the reel: a rarity-colored gradient, a pane-of-glass highlight across the top,
 * the item's picture and name, and a rarity bar along the bottom.
 *
 * Built only from cheap pieces on purpose. The first time a card scrolls into view it has to be
 * drawn, and at the start of the spin that is about one new card every other frame, so anything
 * expensive here shows up as stutter. Gradients are single native layers; there are no SVGs, no
 * clipping, and no per-card animation (the shine that sweeps across is one layer over the whole
 * reel). Colors arrive as props instead of hooks.
 */
const ReelCard = memo(function ReelCard({
  reward,
  background,
  textColor,
  plain,
}: {
  reward: Reward;
  background: string;
  textColor: string;
  /** For the development reel lab: no pictures, just the flat card, to measure what pictures cost. */
  plain: boolean;
}) {
  const look = describeReward(reward);

  return (
    <View style={[styles.card, { backgroundColor: background, borderColor: `${look.color}55` }]}>
      {!plain && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[`${look.color}59`, `${look.color}14`]}
            style={styles.fill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['#FFFFFF2E', '#FFFFFF00']}
            style={[styles.fill, styles.gloss]}
          />
        </>
      )}
      <View style={styles.picture}>
        {!plain && reward.kind === 'car' && <Car carId={reward.carId} width={52} height={74} />}
        {!plain && reward.kind === 'part' && (
          <PartTile slot={getPart(reward.partId)!.slot} rarity={reward.rarity} size={60} />
        )}
        {!plain && reward.kind === 'paint' && <PaintDot paintId={reward.paintId} size={58} />}
        {!plain && reward.kind === 'golden' && <BoxArt type="golden" width={68} />}
      </View>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.name, { color: textColor }]}>
        {look.name}
      </Text>
      <View style={[styles.bar, { backgroundColor: look.color }]} />
    </View>
  );
});

type Props = {
  cards: Reward[];
  winnerIndex: number;
  /** Width of the visible strip, normally the screen width. */
  width: number;
  /** Where the marker lands on the winner card, as a fraction of the card's width (-0.3 to 0.3). */
  landing: number;
  durationMs: number;
  /** True while the reel is being prepared out of sight: it sweeps once so every card is drawn. */
  warmUp: boolean;
  /** Set to true to start the spin. */
  running: boolean;
  /** Set to true when the spin has stopped, to pop the winner card. */
  popped: boolean;
  /** Development reel lab only: draw plain cards without pictures or gradients. */
  plain?: boolean;
  /** Called as each card crosses the marker, with how far through the spin's time we are (0 to 1). */
  onTick: (cardIndex: number, progress: number) => void;
  onLanded: () => void;
};

/**
 * The spinning strip of cards. It starts fast and eases out over `durationMs`, slides a hair past
 * the winner, and settles back onto it (the reward that was already decided). `onTick` fires each
 * time a card passes the center marker while spinning. While the reel is fast, streaks of light
 * race across it (a cheap stand-in for motion blur, which would double the work of drawing the
 * cards), and one shine sweeps across all the cards. When `popped` is set, the winner card zooms in.
 */
export function CaseReel({
  cards,
  winnerIndex,
  width,
  landing,
  durationMs,
  warmUp,
  running,
  popped,
  plain = false,
  onTick,
  onLanded,
}: Props) {
  const theme = useTheme();
  const x = useSharedValue(0);
  const pop = useSharedValue(0);
  // 0 at the start of the spin, 1 once it has stopped. Speed is "1 - spinT" because the easing's
  // speed falls in a straight line. Starts at 1 so nothing streaks before the spin.
  const spinT = useSharedValue(1);
  const shine = useSharedValue(-1);
  const streak = useSharedValue(0);
  const pulse = useSharedValue(0);
  const landed = useRef(false);
  const spinning = useRef(false);
  const tickRef = useRef(onTick);
  const landedRef = useRef(onLanded);
  useEffect(() => {
    tickRef.current = onTick;
    landedRef.current = onLanded;
    spinning.current = running;
  });

  const winner = describeReward(cards[winnerIndex]);
  const winnerCenter = winnerIndex * STRIDE + CARD_W / 2;
  const finalX = width / 2 - winnerCenter - landing * CARD_W;
  const centeredX = width / 2 - winnerCenter;

  // Ticks only count during the real spin, not during the out-of-sight warm-up sweep.
  const emitTick = useCallback((index: number, progress: number) => {
    if (spinning.current) tickRef.current(index, progress);
  }, []);
  const emitLanded = useCallback(() => {
    if (landed.current) return;
    landed.current = true;
    landedRef.current();
  }, []);

  // Each time a new card crosses the center marker, report it.
  useAnimatedReaction(
    () => Math.floor((width / 2 - x.get()) / STRIDE),
    (current, previous) => {
      if (previous !== null && current !== previous) runOnJS(emitTick)(current, spinT.get());
    },
  );

  // The marker's glow breathes the whole time.
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse]);

  // Warm-up: while the box is still bursting, sweep the strip past the screen once, out of sight, so
  // every card has been drawn (and its picture loaded) before the real spin begins.
  useEffect(() => {
    if (!warmUp) return;
    x.set(
      withTiming(finalX, { duration: 700, easing: Easing.linear }, (finished) => {
        // Back to the start, so the strip never sits on the winner where it could be seen.
        if (finished) x.set(0);
      }),
    );
  }, [warmUp, finalX, x]);

  useEffect(() => {
    if (!running) return;
    cancelAnimation(x);
    x.set(0);
    spinT.set(0);
    spinT.set(withTiming(1, { duration: durationMs, easing: Easing.linear }));
    shine.set(-1);
    shine.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false));
    streak.set(withRepeat(withTiming(1, { duration: 420, easing: Easing.linear }), -1, false));
    x.set(
      withSequence(
        // A steady slowdown: the speed falls in a straight line from about twice the average to
        // zero, so the reel eases to a stop over the whole spin. It ends a hair past the winner...
        withTiming(finalX - OVERSHOOT, { duration: durationMs, easing: Easing.out(Easing.quad) }),
        // ...and settles back onto it.
        withSpring(finalX, { damping: 13, stiffness: 140 }, (finished) => {
          if (finished) runOnJS(emitLanded)();
        }),
      ),
    );
  }, [running, durationMs, finalX, x, spinT, shine, streak, emitLanded]);

  useEffect(() => {
    if (!popped) return;
    x.set(withTiming(centeredX, { duration: 280, easing: Easing.out(Easing.cubic) }));
    pop.set(withSpring(1, { damping: 8, stiffness: 170 }));
    // The shine and streaks are done once the winner is chosen.
    cancelAnimation(shine);
    cancelAnimation(streak);
    shine.set(-1);
  }, [popped, centeredX, x, pop, shine, streak]);

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.3 * pop.get() }],
    shadowOpacity: 0.85 * pop.get(),
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (shine.get() + 1) * 0.5 * (width + 220) - 110 }, { skewX: '-18deg' }],
  }));
  const speed = useAnimatedStyle(() => ({ opacity: (1 - spinT.get()) * 0.75 }));
  const markerGlow = useAnimatedStyle(() => ({
    opacity: 0.7 + 0.3 * pulse.get(),
    shadowOpacity: 0.55 + 0.4 * pulse.get(),
  }));

  return (
    <View style={[styles.viewport, { width, height: CARD_H + VERTICAL_PAD * 2 }]}>
      <Animated.View style={[styles.strip, stripStyle]}>
        {cards.map((reward, i) =>
          i === winnerIndex ? (
            <Animated.View
              key={i}
              style={[styles.winner, { shadowColor: winner.color, zIndex: 2 }, popStyle]}>
              <ReelCard reward={reward} background={theme.backgroundElement} textColor={theme.text} plain={plain} />
            </Animated.View>
          ) : (
            <ReelCard
              key={i}
              reward={reward}
              background={theme.backgroundElement}
              textColor={theme.text}
              plain={plain}
            />
          ),
        )}
      </Animated.View>

      {!plain && (
        <>
          {/* One shine sweeping over all the cards. */}
          <Animated.View pointerEvents="none" style={[styles.shine, shineStyle]}>
            <LinearGradient
              colors={['#FFFFFF00', '#FFFFFF47', '#FFFFFF00']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Streaks of light while the reel is fast. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, speed]}>
            {[0.22, 0.4, 0.58, 0.76].map((at, i) => (
              <Streak key={i} top={VERTICAL_PAD + CARD_H * at} offset={i / 4} streak={streak} width={width} />
            ))}
          </Animated.View>

          {/* The reel fades into the dark at both edges. */}
          <LinearGradient
            pointerEvents="none"
            colors={['#0A0D14F2', '#0A0D1400']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.edge, { left: 0 }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['#0A0D1400', '#0A0D14F2']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.edge, { right: 0 }]}
          />
        </>
      )}

      {/* the glowing center marker */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.markerLine,
          { left: width / 2 - 1.5, backgroundColor: theme.accent, shadowColor: theme.accent },
          markerGlow,
        ]}
      />
      <View pointerEvents="none" style={[styles.arrow, styles.arrowTop, { left: width / 2 - 9, borderTopColor: theme.accent }]} />
      <View pointerEvents="none" style={[styles.arrow, styles.arrowBottom, { left: width / 2 - 9, borderBottomColor: theme.accent }]} />
    </View>
  );
}

/** One thin streak of light that keeps racing across the reel, one pass per loop. */
function Streak({
  top,
  offset,
  streak,
  width,
}: {
  top: number;
  offset: number;
  streak: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: ((streak.get() + offset) % 1) * (width + 260) - 130 }],
  }));
  return (
    <Animated.View style={[styles.streak, { top }, style]}>
      <LinearGradient
        colors={['#FFFFFF00', '#FFFFFF8C', '#FFFFFF00']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: { justifyContent: 'center' },
  strip: { flexDirection: 'row', gap: GAP, alignItems: 'center' },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
  },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: RADIUS },
  gloss: { bottom: '52%', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  picture: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  name: {
    textAlign: 'center',
    paddingBottom: BAR_H + Spacing.one,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 500,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_H,
    borderBottomLeftRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
  },
  winner: { shadowOffset: { width: 0, height: 0 }, shadowRadius: 18, shadowOpacity: 0 },
  shine: { position: 'absolute', top: VERTICAL_PAD, height: CARD_H, width: 90 },
  streak: { position: 'absolute', left: 0, width: 130, height: 2 },
  edge: { position: 'absolute', top: 0, bottom: 0, width: 56 },
  markerLine: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowTop: { top: 0, borderTopWidth: 12 },
  arrowBottom: { bottom: 0, borderBottomWidth: 12 },
});
