import { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BoxArt } from '@/components/lot/box-art';
import { Car } from '@/components/lot/car';
import { ParticleBurst } from '@/components/lot/burst';
import { PartTile } from '@/components/lot/part-tile';
import { getPaint } from '@/constants/paints';
import { getPart } from '@/constants/parts';
import { Spacing } from '@/constants/theme';
import type { Reward } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { describeReward } from '@/utils/rewards-ui';

export const CARD_W = 104;
export const CARD_H = 132;
const GAP = 8;
export const STRIDE = CARD_W + GAP;
const VERTICAL_PAD = 26;
const RADIUS = 16;
const BAR_H = 6;

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
 * One card on the reel: the item's picture and name, with a rarity-colored bar along the bottom.
 *
 * Built only from plain, cheap-to-draw pieces on purpose. The first time a card scrolls into view
 * it has to be drawn, and at the start of the spin that is about one new card every other frame, so
 * anything expensive here shows up as stutter. That is why the bottom edge is a separate flat bar
 * (a card border that is thick on one side only is drawn the slow way), why there are no SVGs or
 * clipping, and why colors arrive as props instead of hooks.
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
    <View style={[styles.card, { backgroundColor: background }]}>
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
  /** Set to true when the spin has stopped, to pop the winner card and burst particles. */
  popped: boolean;
  gold: boolean;
  /** Development reel lab only: draw plain cards without pictures. */
  plain?: boolean;
  onTick: (cardIndex: number) => void;
  onLanded: () => void;
};

/**
 * The spinning strip of cards. It starts fast and eases out over `durationMs`, stopping on the
 * winner card (which is the reward that was already decided). `onTick` fires each time a card
 * passes the center marker while spinning, so the haptics and sounds slow down as the reel does.
 * When `popped` is set, the winner card zooms in and a burst of particles goes off.
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
  gold,
  plain = false,
  onTick,
  onLanded,
}: Props) {
  const theme = useTheme();
  const x = useSharedValue(0);
  const pop = useSharedValue(0);
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
  const emitTick = useCallback((index: number) => {
    if (spinning.current) tickRef.current(index);
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
      if (previous !== null && current !== previous) runOnJS(emitTick)(current);
    },
  );

  // Warm-up: while the box is still shaking, sweep the strip past the screen once, out of sight, so
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
    x.set(
      withTiming(
        finalX,
        // Starts at about twice the average speed and settles slowly. A sharper start made cards
        // jump over half their width per frame, which looks choppy however smoothly it renders.
        { duration: durationMs, easing: Easing.bezier(0.3, 0.6, 0.2, 1) },
        (finished) => {
          if (finished) runOnJS(emitLanded)();
        },
      ),
    );
  }, [running, durationMs, finalX, x, emitLanded]);

  useEffect(() => {
    if (!popped) return;
    x.set(withTiming(centeredX, { duration: 280, easing: Easing.out(Easing.cubic) }));
    pop.set(withSpring(1, { damping: 8, stiffness: 170 }));
  }, [popped, centeredX, x, pop]);

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.3 * pop.get() }],
    shadowOpacity: 0.85 * pop.get(),
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

      {/* the center marker */}
      <View pointerEvents="none" style={[styles.markerLine, { left: width / 2 - 1.5, backgroundColor: theme.accent }]} />
      <View pointerEvents="none" style={[styles.arrow, styles.arrowTop, { left: width / 2 - 9, borderTopColor: theme.accent }]} />
      <View pointerEvents="none" style={[styles.arrow, styles.arrowBottom, { left: width / 2 - 9, borderBottomColor: theme.accent }]} />

      <ParticleBurst color={winner.color} gold={gold} trigger={popped ? 1 : 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { justifyContent: 'center' },
  strip: { flexDirection: 'row', gap: GAP, alignItems: 'center' },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: RADIUS,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
  },
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
  markerLine: { position: 'absolute', top: 10, bottom: 10, width: 3, borderRadius: 2, opacity: 0.9 },
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
