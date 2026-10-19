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
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { BoxArt } from '@/components/lot/box-art';
import { Car } from '@/components/lot/car';
import { ParticleBurst } from '@/components/lot/burst';
import { PartTile } from '@/components/lot/part-tile';
import { getPaint } from '@/constants/paints';
import { getPart } from '@/constants/parts';
import { Radius, Spacing } from '@/constants/theme';
import type { Reward } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { describeReward } from '@/utils/rewards-ui';

export const CARD_W = 104;
export const CARD_H = 132;
const GAP = 8;
export const STRIDE = CARD_W + GAP;
const VERTICAL_PAD = 26;

/** A round swatch for a paint card. */
function PaintDot({ paintId, size }: { paintId: string; size: number }) {
  const paint = getPaint(paintId);
  if (!paint) return null;
  const id = `reel-${paintId}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={paint.color} />
          <Stop offset="1" stopColor={paint.color2 ?? paint.color} />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="46" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * One card on the reel: the item's picture and name, with a bottom border in its rarity color.
 *
 * Kept as light as possible, because up to 60 of them are on screen's strip at once: the colors
 * come in as props (no hooks per card), the name is a plain Text, and every card except the winner
 * is drawn once and then moved as a single flat image (`shouldRasterizeIOS`), so sliding the strip
 * doesn't re-draw anything. The winner is left live so it can scale up crisply.
 */
const ReelCard = memo(function ReelCard({
  reward,
  background,
  textColor,
  rasterize,
}: {
  reward: Reward;
  background: string;
  textColor: string;
  rasterize: boolean;
}) {
  const look = describeReward(reward);

  return (
    <View
      shouldRasterizeIOS={rasterize}
      style={[styles.card, { backgroundColor: background, borderBottomColor: look.color }]}>
      <View style={styles.picture}>
        {reward.kind === 'car' && <Car carId={reward.carId} width={52} height={74} />}
        {reward.kind === 'part' && <PartTile slot={getPart(reward.partId)!.slot} rarity={reward.rarity} size={60} />}
        {reward.kind === 'paint' && <PaintDot paintId={reward.paintId} size={58} />}
        {reward.kind === 'golden' && <BoxArt type="golden" width={68} />}
      </View>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.name, { color: textColor }]}>
        {look.name}
      </Text>
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
  /** Set to true to start the spin. */
  running: boolean;
  /** Raise this number to stop the spin right now, on the winner. */
  finishNow: number;
  /** Set to true when the spin has stopped, to pop the winner card and burst particles. */
  popped: boolean;
  gold: boolean;
  onTick: (cardIndex: number) => void;
  onLanded: () => void;
};

/**
 * The spinning strip of cards. It starts fast and eases out over `durationMs`, stopping on the
 * winner card (which is the reward that was already decided). `onTick` fires each time a card
 * passes the center marker, so the haptics and sounds slow down as the reel does. When
 * `popped` is set, the winner card zooms in and a burst of particles goes off.
 */
export function CaseReel({
  cards,
  winnerIndex,
  width,
  landing,
  durationMs,
  running,
  finishNow,
  popped,
  gold,
  onTick,
  onLanded,
}: Props) {
  const theme = useTheme();
  const x = useSharedValue(0);
  const pop = useSharedValue(0);
  const landed = useRef(false);
  const tickRef = useRef(onTick);
  const landedRef = useRef(onLanded);
  useEffect(() => {
    tickRef.current = onTick;
    landedRef.current = onLanded;
  });

  const winner = describeReward(cards[winnerIndex]);
  const winnerCenter = winnerIndex * STRIDE + CARD_W / 2;
  const finalX = width / 2 - winnerCenter - landing * CARD_W;
  const centeredX = width / 2 - winnerCenter;

  const emitTick = useCallback((index: number) => tickRef.current(index), []);
  const emitLanded = useCallback(() => {
    if (landed.current) return;
    landed.current = true;
    landedRef.current();
  }, []);

  // Each time a new card crosses the center marker, report it.
  useAnimatedReaction(
    () => Math.floor((width / 2 - x.value) / STRIDE),
    (current, previous) => {
      if (previous !== null && current !== previous) runOnJS(emitTick)(current);
    },
  );

  useEffect(() => {
    if (!running) return;
    x.set(
      withTiming(
        finalX,
        // Starts at about 3x the average speed and settles slowly. (A sharper start made cards
        // jump more than half their width per frame, which looks choppy however smooth it runs.)
        { duration: durationMs, easing: Easing.bezier(0.2, 0.6, 0.2, 1) },
        (finished) => {
          if (finished) runOnJS(emitLanded)();
        },
      ),
    );
  }, [running, durationMs, finalX, x, emitLanded]);

  useEffect(() => {
    if (finishNow === 0) return;
    cancelAnimation(x);
    x.set(finalX);
    emitLanded();
  }, [finishNow, finalX, x, emitLanded]);

  useEffect(() => {
    if (!popped) return;
    x.set(withTiming(centeredX, { duration: 280, easing: Easing.out(Easing.cubic) }));
    pop.set(withSpring(1, { damping: 8, stiffness: 170 }));
  }, [popped, centeredX, x, pop]);

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.3 * pop.value }],
    shadowOpacity: 0.85 * pop.value,
  }));

  return (
    <View style={[styles.viewport, { width, height: CARD_H + VERTICAL_PAD * 2 }]}>
      <Animated.View style={[styles.strip, stripStyle]}>
        {cards.map((reward, i) =>
          i === winnerIndex ? (
            <Animated.View
              key={i}
              style={[styles.winner, { shadowColor: winner.color, zIndex: 2 }, popStyle]}>
              <ReelCard
                reward={reward}
                background={theme.backgroundElement}
                textColor={theme.text}
                rasterize={false}
              />
            </Animated.View>
          ) : (
            <ReelCard
              key={i}
              reward={reward}
              background={theme.backgroundElement}
              textColor={theme.text}
              rasterize
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
    borderRadius: Radius.chip - 6,
    borderBottomWidth: 6,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    gap: Spacing.one,
  },
  picture: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  name: { textAlign: 'center', paddingBottom: Spacing.one, fontSize: 13, lineHeight: 18, fontWeight: 500 },
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
