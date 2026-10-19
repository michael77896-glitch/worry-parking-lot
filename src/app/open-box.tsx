import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  SlideInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { BoxArt } from '@/components/lot/box-art';
import { ParticleBurst } from '@/components/lot/burst';
import { Car } from '@/components/lot/car';
import { PartTile } from '@/components/lot/part-tile';
import { CaseReel } from '@/components/lot/reel';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getCar } from '@/constants/car-catalog';
import { getPaint } from '@/constants/paints';
import { getPart, SLOT_LABEL } from '@/constants/parts';
import { RARITIES, RARITY_LABEL, type Rarity } from '@/constants/rarity';
import { BOX_LABEL } from '@/constants/rewards';
import { Radius, Spacing } from '@/constants/theme';
import {
  buildReel,
  getBox,
  listBoxes,
  openBox,
  resolveDuplicate,
  type Box,
  type Reward,
} from '@/data';
import type { FrameReport } from '@/dev/frame-meter';
import { useOpeningPrefs } from '@/hooks/use-opening-prefs';
import { useTheme } from '@/hooks/use-theme';
import { burstHaptic, createSfx, landHaptic, revealSfx, shakeHaptic, tickHaptic, type Sfx } from '@/utils/feedback';
import { describeReward } from '@/utils/rewards-ui';

// Development only: lets the Garage's test boxes hold a chosen rarity. Not bundled in release builds.
const forcedRandom: ((rarity: Rarity) => () => number) | undefined = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/forced-roll').forcedRandom
  : undefined;

// Development only: measures how smooth the spin was and shows the numbers. Not bundled in release.
const useMeter: (active: boolean) => { reset(): void; read(): FrameReport } | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/frame-meter').useFrameMeter
  : () => null;

const SHAKE_MS = 1000;
const BURST_MS = 380;
const SPIN_MS = 4200;
/**
 * Ticks closer together than this are skipped. Haptics and sound run on the same thread that draws
 * the screen, so firing one for every one of the ~30 cards a second at the start of the spin
 * would itself make the reel stutter.
 */
const MIN_TICK_GAP_MS = 75;
const BOX_WIDTH = 190;

type Stage = 'loading' | 'missing' | 'closed' | 'shaking' | 'bursting' | 'spinning' | 'landed' | 'revealed';

/** One soft pulse of color over the screen, never a strobe. */
function FlashLayer({ color, trigger, strength }: { color: string; trigger: number; strength: number }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (trigger <= 0) return;
    opacity.value = withSequence(withTiming(strength, { duration: 110 }), withTiming(0, { duration: 800 }));
  }, [trigger, strength, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}

function PaintSwatch({ paintId }: { paintId: string }) {
  const paint = getPaint(paintId);
  if (!paint) return null;
  return (
    <Svg width={120} height={120} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="reveal-swatch" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={paint.color} />
          <Stop offset="1" stopColor={paint.color2 ?? paint.color} />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="46" fill="url(#reveal-swatch)" />
    </Svg>
  );
}

/**
 * Opening a box, like a case opening. Tap the box: it shakes harder and harder, then bursts open
 * with a strong haptic. A reel of item cards spins past a center marker and eases out over about
 * four seconds, with a light haptic tick and a sound for each card that passes. It stops on the
 * reward. The reward was decided (and saved) before the spin, using the real odds: the reel is only
 * made to land on it. The winner pops, the screen gives one soft flash of its rarity color, and
 * particles burst out (gold gets more, a longer haptic, and a pause). Then the item is shown big.
 *
 * Skip jumps to the reveal. Quick opening (in Settings) and Reduce Motion skip the show entirely.
 * The speaker button mutes the sounds. Nothing here costs anything: boxes are only ever earned.
 */
export default function OpenBoxScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const prefs = useOpeningPrefs();
  const { id, force } = useLocalSearchParams<{ id: string; force?: string }>();
  const boxId = Number(id);

  const [box, setBox] = useState<Box | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [others, setOthers] = useState<Box[]>([]);
  const [busy, setBusy] = useState(false);
  const [reel, setReel] = useState<{ cards: Reward[]; winnerIndex: number; landing: number } | null>(null);
  const [popped, setPopped] = useState(false);
  const [flash, setFlash] = useState(0);
  const [boxBurst, setBoxBurst] = useState(0);
  const [stowed, setStowed] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastTick = useRef(0);
  const landedSound = useRef(false);
  const sfx = useRef<ReturnType<typeof createSfx> | null>(null);
  const soundOn = useRef(true);
  useEffect(() => {
    soundOn.current = prefs.sound;
  });

  const shake = useSharedValue(0);
  const boxScale = useSharedValue(1);
  const pop = useSharedValue(0);
  const drive = useSharedValue(0);
  // A plain screen-colored cover over the reel until the spin starts. It fades away at the start.
  const coverOpacity = useSharedValue(1);
  const meter = useMeter(stage === 'spinning' || stage === 'landed');
  const [report, setReport] = useState<FrameReport | null>(null);

  function play(name: Sfx) {
    if (soundOn.current) sfx.current?.play(name);
  }

  function later(ms: number, fn: () => void) {
    timers.current.push(setTimeout(fn, ms));
  }

  async function refresh(openedBox?: Box) {
    const current = openedBox ?? (await getBox(db, boxId));
    setBox(current);
    setOthers((await listBoxes(db)).filter((b) => b.id !== boxId && !b.openedAt));
    return current;
  }

  useEffect(() => {
    sfx.current = createSfx();
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
      sfx.current?.release();
      sfx.current = null;
    };
  }, [db, boxId]);

  const reward = box?.result?.reward;
  const look = reward ? describeReward(reward) : null;
  const gold = look?.rarity === 'legendary' || look?.rarity === 'golden';
  const waitingDuplicate = !!box?.result?.duplicate && !box.resolvedAt;

  function showReveal() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStage('revealed');
  }

  /** Skip: straight to the reveal. */
  function skip() {
    if (look && !landedSound.current) {
      landedSound.current = true;
      play(revealSfx(look.rarity));
    }
    showReveal();
  }

  async function open() {
    if (stage !== 'closed' || busy) return;
    setBusy(true);
    try {
      // The reward is decided and saved first. Everything after this only shows it.
      const forced = force && (RARITIES as readonly string[]).includes(force) ? (force as Rarity) : null;
      const { box: opened } = await openBox(db, boxId, new Date(), forced && forcedRandom ? forcedRandom(forced) : undefined);
      await refresh(opened);
      const won = opened.result!.reward;
      const wonLook = describeReward(won);
      const built = buildReel(opened.type, won);
      setReel({ ...built, landing: (Math.random() - 0.5) * 0.6 });

      if (prefs.quick || reducedMotion) {
        landedSound.current = true;
        play(revealSfx(wonLook.rarity));
        landHaptic(wonLook.rarity);
        setStage('revealed');
        return;
      }

      // 1. The box shakes harder and harder.
      setStage('shaking');
      boxScale.value = withTiming(1.1, { duration: SHAKE_MS, easing: Easing.in(Easing.quad) });
      const swings = [3, -3, 5, -5, 7, -7, 9, -9, 11, -11, 13, -13, 15, -15, 0];
      shake.value = withSequence(...swings.map((a, i) => withTiming(a, { duration: 74 - i * 1.5 })));
      [0, 190, 380, 540, 680, 800, 900].forEach((at, i, all) => later(at, () => shakeHaptic(i / (all.length - 1))));

      // 2. It bursts open.
      later(SHAKE_MS, () => {
        setStage('bursting');
        setBoxBurst(1);
        play('open');
        burstHaptic();
        pop.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) });
        boxScale.value = withTiming(1.22, { duration: BURST_MS, easing: Easing.out(Easing.cubic) });
      });

      // 3. The reel spins.
      later(SHAKE_MS + BURST_MS, () => {
        meter?.reset();
        setStage('spinning');
        coverOpacity.value = withTiming(0, { duration: 220 });
      });
    } catch {
      Alert.alert("Couldn't open that box", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function onTick() {
    const now = Date.now();
    if (now - lastTick.current < MIN_TICK_GAP_MS) return;
    lastTick.current = now;
    tickHaptic();
    play('tick');
  }

  function onLanded() {
    if (!look) return;
    // 4. The winner pops, the screen flashes its color once, particles burst out.
    if (meter) setReport(meter.read());
    setStage('landed');
    setPopped(true);
    setFlash((n) => n + 1);
    landedSound.current = true;
    play(revealSfx(look.rarity));
    landHaptic(look.rarity);
    // Gold gets a longer pause before the reveal.
    later(gold ? 1100 : 550, showReveal);
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

  // 5. After the reveal, the car drives into the garage (once any duplicate choice is made).
  const isCar = reward?.kind === 'car';
  const canStow = stage === 'revealed' && isCar && !waitingDuplicate;
  useEffect(() => {
    if (!canStow || stowed) return;
    const t = setTimeout(
      () => {
        setStowed(true);
        drive.value = reducedMotion ? 1 : withTiming(1, { duration: 800, easing: Easing.in(Easing.cubic) });
      },
      reducedMotion ? 0 : 1100,
    );
    return () => clearTimeout(t);
  }, [canStow, stowed, reducedMotion, drive]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: boxScale.value }],
    opacity: 1 - pop.value * 0.55,
  }));
  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pop.value * 40 }, { rotate: `${-pop.value * 18}deg` }],
    opacity: 1 - pop.value * 0.7,
  }));
  const driveStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drive.value * 320 }, { scale: 1 - drive.value * 0.35 }],
    opacity: 1 - drive.value,
  }));

  const coverStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.get() }));

  const showingBox = stage === 'closed' || stage === 'shaking' || stage === 'bursting';
  const reelVisible = stage === 'spinning' || stage === 'landed';
  const animating = stage === 'shaking' || stage === 'bursting' || stage === 'spinning' || stage === 'landed';

  return (
    <>
      <Screen>
        <View style={styles.header}>
          <BackLink />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={prefs.sound ? 'Mute sound effects' : 'Turn sound effects on'}
            accessibilityState={{ selected: !prefs.sound }}
            onPress={() => prefs.setSound(!prefs.sound)}
            hitSlop={8}
            style={styles.mute}>
            <SymbolView
              name={prefs.sound ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
              tintColor={prefs.sound ? theme.text : theme.textSecondary}
              size={22}
            />
          </Pressable>
        </View>
        <ThemedText type="subtitle">{box ? BOX_LABEL[box.type] : 'Box'}</ThemedText>

        {stage === 'missing' && <ThemedText>That box isn&apos;t here anymore.</ThemedText>}

        {(showingBox || reelVisible) && box && (
          <>
            {showingBox && (
              <ThemedText themeColor="textSecondary">
                {stage === 'closed' ? 'You earned this one. There is no cost to open it.' : 'Opening…'}
              </ThemedText>
            )}
            <View style={styles.stage}>
              {/* The reel is built as soon as the reward is known and kept covered during the
                  shake, so its pictures are loaded and every card is drawn once (the warm-up
                  sweep) before the spin starts. Building 60 cards, or drawing each for the first
                  time, mid-spin is what made it stutter. It is covered rather than made see-through
                  because a see-through group of 60 cards is itself slow to draw. */}
              {reel && (
                <>
                  <View pointerEvents="none" style={[styles.reelLayer, { width: windowWidth }]}>
                    <CaseReel
                      cards={reel.cards}
                      winnerIndex={reel.winnerIndex}
                      width={windowWidth}
                      landing={reel.landing}
                      durationMs={SPIN_MS}
                      warmUp={stage === 'shaking' || stage === 'bursting'}
                      running={reelVisible}
                      popped={popped}
                      gold={gold}
                      onTick={onTick}
                      onLanded={onLanded}
                    />
                  </View>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.reelLayer, styles.reelCover, { width: windowWidth, backgroundColor: theme.background }, coverStyle]}
                  />
                </>
              )}

              {showingBox && (
                <>
                  <Pressable
                    disabled={stage !== 'closed' || busy}
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel={`${BOX_LABEL[box.type]}. Tap to open.`}>
                    <Animated.View style={shakeStyle}>
                      <BoxArt type={box.type} width={BOX_WIDTH} lidStyle={lidStyle} />
                    </Animated.View>
                  </Pressable>
                  <ParticleBurst color={theme.accent} gold={false} trigger={boxBurst} />
                </>
              )}
            </View>
            {stage === 'closed' && (
              <>
                <Button label="Open" onPress={open} accessibilityHint="Opens the box and shows what is inside" />
                {prefs.loaded && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={prefs.quick ? 'Quick opening is on. Turn it off.' : 'Quick opening is off. Turn it on.'}
                    onPress={() => prefs.setQuick(!prefs.quick)}
                    hitSlop={8}
                    style={styles.link}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
                      {prefs.quick ? 'Quick opening is on (turn off)' : 'Skip the show with quick opening'}
                    </ThemedText>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}

        {stage === 'landed' && look && (
          <Animated.View entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)}>
            <ThemedText type="title" style={[styles.centerText, { color: look.color }]} accessibilityLiveRegion="polite">
              {look.rarityLabel}
            </ThemedText>
          </Animated.View>
        )}

        {animating && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip the animation"
            onPress={skip}
            hitSlop={8}
            style={styles.link}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.underline}>
              Skip
            </ThemedText>
          </Pressable>
        )}

        {stage === 'revealed' && box && look && reward && (
          <Animated.View entering={FadeIn.duration(350).reduceMotion(ReduceMotion.System)} style={styles.reveal}>
            <View
              style={[styles.rarityBar, { borderColor: look.color }]}
              accessible
              accessibilityLabel={look.rarityLabel}>
              <ThemedText type="smallBold" style={{ color: look.color }}>
                {look.rarityLabel}
              </ThemedText>
            </View>

            {reward.kind === 'car' && (
              <>
                <View style={[styles.carBig, { minHeight: 290 }]}>
                  {!(stowed && reducedMotion) && (
                    <Animated.View style={driveStyle}>
                      <Car carId={reward.carId} width={170} height={280} />
                    </Animated.View>
                  )}
                </View>
                <ThemedText type="title" style={styles.centerText}>
                  {getCar(reward.carId).name}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  {RARITY_LABEL[reward.rarity]} · {getCar(reward.carId).style}
                </ThemedText>
              </>
            )}

            {reward.kind === 'part' && (
              <>
                <Animated.View
                  entering={SlideInRight.duration(550).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)}
                  style={styles.center}>
                  <PartTile slot={getPart(reward.partId)!.slot} rarity={reward.rarity} size={150} />
                </Animated.View>
                <ThemedText type="title" style={styles.centerText}>
                  {getPart(reward.partId)!.name}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  {RARITY_LABEL[reward.rarity]} {SLOT_LABEL[getPart(reward.partId)!.slot].toLowerCase()} part. Put it on a
                  car in the Mod shop.
                </ThemedText>
              </>
            )}

            {reward.kind === 'paint' && (
              <>
                <View style={styles.center}>
                  <PaintSwatch paintId={reward.paintId} />
                </View>
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
                <View style={styles.center}>
                  <BoxArt type="golden" width={170} />
                </View>
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
                  Keep it as a separate copy that you can paint and mod on its own, or trade it for a Glovebox.
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

            {!waitingDuplicate && isCar && box.result?.choice === 'trade' && (
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                Traded for a Glovebox. It&apos;s waiting in your garage.
              </ThemedText>
            )}
            {!waitingDuplicate && isCar && box.result?.choice !== 'trade' && (stowed || reducedMotion) && (
              <Animated.View entering={FadeIn.duration(400).reduceMotion(ReduceMotion.System)}>
                <ThemedText themeColor="textSecondary" style={styles.centerText} accessibilityLiveRegion="polite">
                  {box.result?.choice === 'keep' ? 'Kept as a separate copy. ' : ''}Added to your garage.
                </ThemedText>
              </Animated.View>
            )}

            {report && (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                Reel timing (development only): {report.averageFps} fps on average, worst frame {report.worstMs} ms,{' '}
                {report.slowFrames} of {report.frames} frames over 25 ms.
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
                <Button
                  label="Done"
                  variant={reward.kind === 'golden' ? 'secondary' : 'primary'}
                  onPress={() => router.back()}
                />
              </>
            )}
          </Animated.View>
        )}
      </Screen>

      {/* One soft pulse of the rarity color over the whole screen when the reel stops. */}
      {look && <FlashLayer color={look.color} trigger={flash} strength={gold ? 0.42 : 0.3} />}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mute: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', height: 270 },
  // Full screen width (the screen's side padding is cancelled), centered in the stage.
  reelLayer: { position: 'absolute', left: -Spacing.four, top: 43 },
  // The same size as the reel's viewport (cards are 132 high, plus 26 above and below).
  reelCover: { height: 184 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  underline: { textDecorationLine: 'underline' },
  reveal: { gap: Spacing.three },
  center: { alignItems: 'center' },
  carBig: { alignItems: 'center', justifyContent: 'flex-start' },
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
