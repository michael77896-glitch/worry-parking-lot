import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  SlideInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { BoxArt } from '@/components/lot/box-art';
import { ParkingSpot } from '@/components/lot/parking-spot';
import { PartTile } from '@/components/lot/part-tile';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getCar } from '@/constants/car-catalog';
import { getPaint } from '@/constants/paints';
import { getPart, SLOT_LABEL } from '@/constants/parts';
import { isAtLeast, RARITY_COLOR, RARITY_LABEL, type Rarity } from '@/constants/rarity';
import { BOX_LABEL } from '@/constants/rewards';
import { Radius, Spacing } from '@/constants/theme';
import { getBox, listBoxes, openBox, resolveDuplicate, type Box } from '@/data';
import { useTheme } from '@/hooks/use-theme';

const BOX_WIDTH = 190;
const SHAKE_MS = 850;
const POP_MS = 550;

type Stage = 'loading' | 'missing' | 'closed' | 'shaking' | 'popping' | 'revealed';

/** The rarity of what a box held, as a label and a color. A Golden Crate counts as Legendary gold. */
function rarityOf(box: Box): { label: string; color: string; rarity: Rarity } {
  const reward = box.result?.reward;
  if (!reward || reward.kind === 'golden') return { label: 'Golden Crate', color: RARITY_COLOR.legendary, rarity: 'legendary' };
  return { label: RARITY_LABEL[reward.rarity], color: RARITY_COLOR[reward.rarity], rarity: reward.rarity };
}

async function buzz(rarity: Rarity | null) {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (rarity && isAtLeast(rarity, 'epic')) {
      setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 140);
    }
  } catch {
    // No haptics on this device: the animation and the color still say it.
  }
}

/**
 * Opening a box. The box shakes, pops open with a haptic buzz, glows in the rarity's color, and
 * then the car or part drives or slides in. With Reduce Motion on, it skips straight to the
 * reveal. "Skip" is always there. Nothing here costs anything: boxes are only ever earned.
 */
export default function OpenBoxScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const boxId = Number(id);

  const [box, setBox] = useState<Box | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [others, setOthers] = useState<Box[]>([]);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const shake = useSharedValue(0);
  const pop = useSharedValue(0);

  async function refresh(openedBox?: Box) {
    const current = openedBox ?? (await getBox(db, boxId));
    setBox(current);
    setOthers((await listBoxes(db)).filter((b) => b.id !== boxId && !b.openedAt));
    return current;
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await getBox(db, boxId);
      const rest = (await listBoxes(db)).filter((b) => b.id !== boxId && !b.openedAt);
      if (!active) return;
      setBox(current);
      setOthers(rest);
      setStage(!current ? 'missing' : current.openedAt ? 'revealed' : 'closed');
    })();
    const pending = timers.current;
    return () => {
      active = false;
      pending.forEach(clearTimeout);
    };
  }, [db, boxId]);

  function later(ms: number, fn: () => void) {
    timers.current.push(setTimeout(fn, ms));
  }

  function skip() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pop.value = 1;
    shake.value = 0;
    setStage('revealed');
  }

  async function open() {
    if (stage !== 'closed' || busy) return;
    setBusy(true);
    try {
      // The result is decided and saved first; the animation only reveals it.
      const { box: opened } = await openBox(db, boxId);
      await refresh(opened);
      const { rarity } = rarityOf(opened);
      if (reducedMotion) {
        pop.value = 1;
        void buzz(rarity);
        setStage('revealed');
        return;
      }
      setStage('shaking');
      shake.value = withSequence(
        withTiming(-7, { duration: 70 }),
        withRepeat(withSequence(withTiming(7, { duration: 110 }), withTiming(-7, { duration: 110 })), 3, false),
        withTiming(0, { duration: 70 }),
      );
      later(SHAKE_MS, () => {
        setStage('popping');
        pop.value = withTiming(1, { duration: POP_MS, easing: Easing.out(Easing.cubic) });
        void buzz(rarity);
      });
      later(SHAKE_MS + POP_MS + 150, () => setStage('revealed'));
    } catch {
      Alert.alert("Couldn't open that box", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(choice: 'keep' | 'trade') {
    if (!box || busy) return;
    setBusy(true);
    try {
      await resolveDuplicate(db, box.id, choice);
      await refresh();
    } catch {
      Alert.alert("Couldn't save that", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pop.value * 34 }, { rotate: `${-pop.value * 16}deg` }],
    opacity: 1 - pop.value * 0.6,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: pop.value * 0.55,
    transform: [{ scale: 0.55 + pop.value * 0.9 }],
  }));

  const shown = box?.result ? rarityOf(box) : null;
  const reward = box?.result?.reward;
  const waitingDuplicate = !!box?.result?.duplicate && !box.resolvedAt;
  const showingBox = stage === 'closed' || stage === 'shaking' || stage === 'popping';

  return (
    <Screen>
      <BackLink />
      <ThemedText type="subtitle">{box ? BOX_LABEL[box.type] : 'Box'}</ThemedText>

      {stage === 'missing' && <ThemedText>That box isn&apos;t here anymore.</ThemedText>}

      {showingBox && box && (
        <>
          <ThemedText themeColor="textSecondary">
            {stage === 'closed'
              ? 'You earned this one. There is no cost to open it.'
              : 'Opening…'}
          </ThemedText>
          <View style={styles.stage}>
            {shown && (
              <Animated.View
                pointerEvents="none"
                style={[styles.glow, { backgroundColor: shown.color }, glowStyle]}
              />
            )}
            <Animated.View style={shakeStyle}>
              <BoxArt type={box.type} width={BOX_WIDTH} lidStyle={lidStyle} />
            </Animated.View>
          </View>
          {stage === 'closed' ? (
            <Button label="Open" onPress={open} accessibilityHint="Opens the box and shows what is inside" />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip the animation"
              onPress={skip}
              hitSlop={8}
              style={styles.skip}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
                Skip
              </ThemedText>
            </Pressable>
          )}
        </>
      )}

      {stage === 'revealed' && box && shown && reward && (
        <Animated.View entering={FadeIn.duration(350).reduceMotion(ReduceMotion.System)} style={styles.reveal}>
          <View style={[styles.rarityBar, { borderColor: shown.color }]} accessible accessibilityLabel={`${shown.label}`}>
            <ThemedText type="smallBold" style={{ color: shown.color }}>
              {shown.label}
            </ThemedText>
          </View>

          {reward.kind === 'car' && (
            <>
              <View style={styles.center}>
                <ParkingSpot
                  width={150}
                  car={{ id: reward.carId }}
                  accessibilityLabel={`${getCar(reward.carId).name}, a ${RARITY_LABEL[reward.rarity]} car`}
                />
              </View>
              <ThemedText type="title" style={styles.centerText}>
                {getCar(reward.carId).name}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {getCar(reward.carId).style} · a new car for your garage
              </ThemedText>
            </>
          )}

          {reward.kind === 'part' && (
            <>
              <Animated.View
                entering={SlideInRight.duration(550).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)}
                style={styles.center}>
                <PartTile slot={getPart(reward.partId)!.slot} rarity={reward.rarity} size={104} />
              </Animated.View>
              <ThemedText type="title" style={styles.centerText}>
                {getPart(reward.partId)!.name}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {SLOT_LABEL[getPart(reward.partId)!.slot]} part. Put it on a car in the Mod shop.
              </ThemedText>
            </>
          )}

          {reward.kind === 'paint' && (
            <>
              <Animated.View entering={FadeInDown.duration(550).reduceMotion(ReduceMotion.System)} style={styles.center}>
                <PaintSwatch paintId={reward.paintId} />
              </Animated.View>
              <ThemedText type="title" style={styles.centerText}>
                {getPaint(reward.paintId)?.name}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {box.result?.refund
                  ? `You already had this color-shift paint, so you got ${box.result.refund} tokens instead.`
                  : 'A color-shift paint. Put it on any of your cars for free in the Mod shop.'}
              </ThemedText>
            </>
          )}

          {reward.kind === 'golden' && (
            <>
              <Animated.View entering={FadeInDown.duration(550).reduceMotion(ReduceMotion.System)} style={styles.center}>
                <BoxArt type="golden" width={150} />
              </Animated.View>
              <ThemedText type="title" style={styles.centerText}>
                A Golden Crate
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                It was inside. Golden Crates always hold something Epic or better.
              </ThemedText>
            </>
          )}

          {waitingDuplicate && (
            <View style={[styles.choice, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="headline">You already have this car</ThemedText>
              <ThemedText themeColor="textSecondary">
                Keep it as a separate copy that you can paint and mod on its own, or trade it for a
                Glovebox.
              </ThemedText>
              <Button
                label="Keep a separate copy"
                onPress={() => decide('keep')}
                accessibilityHint="Adds a second copy to your garage that you can mod on its own"
              />
              <Button
                label="Trade for a Glovebox"
                variant="secondary"
                onPress={() => decide('trade')}
                accessibilityHint="Gives you a Glovebox instead of the car"
              />
            </View>
          )}

          {!waitingDuplicate && box.result?.choice === 'keep' && (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Kept as a separate copy in your garage.
            </ThemedText>
          )}
          {!waitingDuplicate && box.result?.choice === 'trade' && (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Traded for a Glovebox. It&apos;s waiting in your garage.
            </ThemedText>
          )}
          {!waitingDuplicate && reward.kind === 'car' && !box.result?.duplicate && (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Added to your garage.
            </ThemedText>
          )}

          {!waitingDuplicate && (
            <>
              {reward.kind === 'golden' && (
                <Button
                  label="Open the Golden Crate"
                  onPress={() => {
                    const crate = others.find((b) => b.type === 'golden' && b.source === `drop:${box.id}`);
                    if (crate) router.replace({ pathname: '/open-box', params: { id: String(crate.id) } });
                    else router.back();
                  }}
                />
              )}
              {others.length > 0 && reward.kind !== 'golden' && (
                <Button
                  label={others.length === 1 ? 'Open the next box' : `Open the next box (${others.length} waiting)`}
                  variant="secondary"
                  onPress={() => router.replace({ pathname: '/open-box', params: { id: String(others[0].id) } })}
                />
              )}
              <Button label="Done" variant={reward.kind === 'golden' ? 'secondary' : 'primary'} onPress={() => router.back()} />
            </>
          )}
        </Animated.View>
      )}
    </Screen>
  );
}

/** A round swatch showing a color-shift paint's two colors. */
function PaintSwatch({ paintId }: { paintId: string }) {
  const paint = getPaint(paintId);
  if (!paint) return null;
  return (
    <Svg width={104} height={104} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="swatch" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={paint.color} />
          <Stop offset="1" stopColor={paint.color2 ?? paint.color} />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="46" fill="url(#swatch)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', height: 250 },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  skip: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  underline: { textDecorationLine: 'underline' },
  reveal: { gap: Spacing.three },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  rarityBar: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.chip,
    borderWidth: 2,
  },
  choice: { borderRadius: Radius.card, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
});
