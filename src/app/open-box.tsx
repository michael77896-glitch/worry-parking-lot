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
  cancelAnimation,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { BackLink } from '@/components/back-link';
import { BoxStage, SceneryCanvas } from '@/components/box/box-stage';
import { LightningLayer } from '@/components/box/lightning-layer';
import { RevealFx } from '@/components/box/reveal-fx';
import { Shimmer } from '@/components/box/shimmer';
import { Turntable } from '@/components/box/turntable';
import { Button } from '@/components/button';
import { BoxArt } from '@/components/lot/box-art';
import { PartTile } from '@/components/lot/part-tile';
import { CaseReel, CARD_H, REEL_SPIN_MS } from '@/components/lot/reel';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BOX_PHOTOS } from '@/constants/box-photos';
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
import {
  BLACKOUT,
  CHARGE_MS,
  chargeHaptic,
  chargeLevel,
  lightningSchedule,
  reelTickAllowed,
  shakeSwings,
  type Flicker,
} from '@/utils/box-effects';
import {
  burstHaptic,
  buzz,
  createSfx,
  landHaptic,
  revealSfx,
  tickHaptic,
  type Sfx,
} from '@/utils/feedback';
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

/** How long the lid-blast, the beam of light, and the quick zoom take. */
const BLAST_MS = 800;
/** From letting go to the reel starting to spin. The reel warms up (draws every card once) in it. */
const BLAST_TO_SPIN_MS = 900;
/** How long after the reel appears before it starts to spin. */
const SPIN_DELAY_MS = 170;
/**
 * Tick sounds closer together than this are skipped. Sound starts run on the same thread that draws
 * the screen. Haptic ticks are rationed separately (see reelTickAllowed): only once the reel has
 * slowed, about four a second at most, because firing one per card made the fast part stutter.
 */
const MIN_SOUND_GAP_MS = 150;
/** The stage is as tall as this; the reel sits in the middle of it. */
const STAGE_H = 360;
const REEL_H = CARD_H + 52;

type Stage = 'loading' | 'missing' | 'closed' | 'charging' | 'bursting' | 'spinning' | 'landed' | 'revealed';

/** One soft pulse of color over the screen, never a strobe. */
function FlashLayer({ color, trigger, strength }: { color: string; trigger: number; strength: number }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (trigger <= 0) return;
    opacity.set(withSequence(withTiming(strength, { duration: 110 }), withTiming(0, { duration: 800 })));
  }, [trigger, strength, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
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
 * Opening a box, like a case opening, and the one loud screen in the app.
 *
 *  1. Stage: the box floats under a spotlight in a dark garage, light rays turning behind it.
 *  2. Charge: press and hold the box. It rattles harder, light leaks from the seam, sparks fly, and
 *     the haptics build. Let go (or wait until it is full) and the lid blasts off under a beam of
 *     light, with a quick zoom.
 *  3. Reel: glossy cards spin past a glowing marker, easing out over about five seconds, sliding a
 *     hair past the winner and settling back. Soft tick sounds throughout; haptic ticks only once
 *     the reel has slowed.
 *  4. Reveal: a shockwave ring and confetti in the rarity's color. Epic adds purple lightning and a
 *     small shake. Legendary goes black for a beat, then a slow-motion gold explosion with gold rain
 *     and a long haptic. Cars turn on a turntable and flash their headlights.
 *
 * The reward was decided (and saved) before any of that, using the real odds: the reel is only made
 * to land on it. Skip jumps to the reveal. Quick opening (in Settings) and Reduce Motion skip the
 * show entirely, and a plain Open button works without holding. The speaker button mutes sounds.
 * Nothing here costs anything: boxes are only ever earned. Light flashes stay under three a second
 * and below full brightness (see src/utils/box-effects.ts, which is tested).
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
  const [fx, setFx] = useState(0);
  const [lightning, setLightning] = useState(0);
  const [flickers, setFlickers] = useState<Flicker[]>([]);
  const [go, setGo] = useState(false);
  const [report, setReport] = useState<FrameReport | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastSound = useRef(0);
  const lastTickHaptic = useRef(0);
  const landedSound = useRef(false);
  const sfx = useRef<ReturnType<typeof createSfx> | null>(null);
  const soundOn = useRef(true);
  const opening = useRef(false);
  const held = useRef<{ start: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  useEffect(() => {
    soundOn.current = prefs.sound;
  });

  // Animation values, all on the UI thread.
  const clock = useSharedValue(0); // seconds, drives the floating, the rays, the rattle, the sparks
  const charge = useSharedValue(0);
  const blast = useSharedValue(0);
  const kick = useSharedValue(0);
  const zoom = useSharedValue(1);
  const afterglow = useSharedValue(0);
  const screenShake = useSharedValue(0);
  const blackout = useSharedValue(0);
  // The stage canvas sits over the reel as a cover until the spin starts, then fades away.
  const coverOpacity = useSharedValue(1);

  const meter = useMeter(go && (stage === 'spinning' || stage === 'landed'));

  // The clock runs while the stage is on screen, except during the spin, when the reel gets all the
  // attention (and all of the drawing), and when Reduce Motion is on (then the stage holds still).
  const frame = useFrameCallback((info) => {
    clock.set(info.timeSinceFirstFrame / 1000);
  }, false);
  const clockRuns = !reducedMotion && (stage === 'closed' || stage === 'charging' || stage === 'bursting' || stage === 'landed');
  useEffect(() => {
    frame.setActive(clockRuns);
  }, [frame, clockRuns]);

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
    const holding = held;
    return () => {
      active = false;
      pending.forEach(clearTimeout);
      if (holding.current?.timer) clearTimeout(holding.current.timer);
      sfx.current?.release();
      sfx.current = null;
    };
  }, [db, boxId]);

  const reward = box?.result?.reward;
  const look = reward ? describeReward(reward) : null;
  const gold = look?.rarity === 'legendary' || look?.rarity === 'golden';
  const waitingDuplicate = !!box?.result?.duplicate && !box.resolvedAt;
  const photo = box ? BOX_PHOTOS[box.type] : null;

  function showReveal() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // If the screen was dark (the Legendary beat), bring it back gently rather than cutting.
    cancelAnimation(blackout);
    blackout.set(withTiming(0, { duration: 200 }));
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

  /** Decides the reward (saved first), then plays the blast and the reel. */
  async function openAndBlast() {
    if (opening.current) return;
    opening.current = true;
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

      // 2. The lid blasts open under a beam of light, with a quick zoom. (Meanwhile the reel warms
      // up out of sight and the sounds are warmed up silently, so nothing starts cold mid-spin.)
      if (soundOn.current) sfx.current?.warmUp();
      setStage('bursting');
      charge.set(withTiming(1, { duration: 150 }));
      blast.set(withTiming(1, { duration: BLAST_MS, easing: Easing.out(Easing.cubic) }));
      kick.set(withSequence(withTiming(8, { duration: 60 }), withTiming(0, { duration: 260 })));
      zoom.set(
        withSequence(
          withTiming(1.14, { duration: 130, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        ),
      );
      play('open');
      burstHaptic();

      // 3. The reel spins.
      // The screen changes first (the stage cover fades) and the spin starts a moment later.
      // Changing the screen costs a few frames, and they shouldn't be the spin's first ones.
      later(BLAST_TO_SPIN_MS, () => {
        setStage('spinning');
        coverOpacity.set(withTiming(0, { duration: 220 }));
      });
      later(BLAST_TO_SPIN_MS + SPIN_DELAY_MS, () => {
        meter?.reset();
        setGo(true);
      });
    } catch {
      opening.current = false;
      Alert.alert("Couldn't open that box", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /** The buzzing while the box is held: faster and firmer as it fills, and it opens when full. */
  function chargeLoop() {
    const current = held.current;
    if (!current) return;
    const level = chargeLevel(Date.now() - current.start);
    if (level >= 1) {
      release();
      return;
    }
    const { gapMs, strength } = chargeHaptic(level);
    buzz(strength);
    current.timer = setTimeout(chargeLoop, gapMs);
  }

  /** Finger down on the box: start charging. */
  function startCharge() {
    if (stage !== 'closed' || opening.current || held.current) return;
    if (prefs.quick || reducedMotion) {
      void openAndBlast();
      return;
    }
    if (soundOn.current) sfx.current?.warmUp();
    setStage('charging');
    held.current = { start: Date.now(), timer: null };
    charge.set(withTiming(1, { duration: CHARGE_MS, easing: Easing.in(Easing.quad) }));
    chargeLoop();
  }

  /** Finger up (or the box is full): the lid blasts. */
  function release() {
    const current = held.current;
    if (!current) return;
    held.current = null;
    if (current.timer) clearTimeout(current.timer);
    void openAndBlast();
  }

  function onTick(_cardIndex: number, progress: number) {
    // Sound spaced out, and haptics only once the reel has slowed down (and then rationed).
    const now = Date.now();
    if (now - lastSound.current >= MIN_SOUND_GAP_MS) {
      lastSound.current = now;
      play('tick');
    }
    if (reelTickAllowed(progress, now - lastTickHaptic.current)) {
      lastTickHaptic.current = now;
      tickHaptic();
    }
  }

  function onLanded() {
    if (!look) return;
    if (meter) setReport(meter.read());
    setStage('landed');
    setPopped(true);
    afterglow.set(withTiming(0.8, { duration: 400 }));
    landedSound.current = true;

    if (gold) {
      // Legendary: everything fades to black for a beat, then a slow-motion gold explosion.
      blackout.set(withTiming(1, { duration: BLACKOUT.fadeInMs }));
      later(BLACKOUT.fadeInMs + BLACKOUT.holdMs, () => {
        setFx((n) => n + 1);
        play(revealSfx(look.rarity));
        landHaptic(look.rarity);
        blackout.set(withTiming(0, { duration: BLACKOUT.fadeOutMs }));
      });
      later(BLACKOUT.fadeInMs + BLACKOUT.holdMs + 3900, showReveal);
      return;
    }

    // Common to Epic: a shockwave ring and confetti in the rarity color.
    setFx((n) => n + 1);
    play(revealSfx(look.rarity));
    landHaptic(look.rarity);
    if (look.rarity === 'epic') {
      // Epic: purple lightning flickers and the screen shakes a little.
      setFlickers(lightningSchedule());
      setLightning((n) => n + 1);
      screenShake.set(withSequence(...shakeSwings().map((a) => withTiming(a, { duration: 45 }))));
      later(1900, showReveal);
    } else {
      setFlash((n) => n + 1); // one soft pulse of the rarity color
      later(900, showReveal);
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

  const isCar = reward?.kind === 'car';

  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.get() }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: screenShake.get() }] }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.get() }));
  const blackoutStyle = useAnimatedStyle(() => ({ opacity: blackout.get() }));

  const showingBox = stage === 'closed' || stage === 'charging' || stage === 'bursting';
  const reelVisible = stage === 'spinning' || stage === 'landed';
  const animating = stage === 'charging' || stage === 'bursting' || stage === 'spinning' || stage === 'landed';
  const sceneColor = popped && look ? look.color : (photo?.color ?? '#6FA8F0');

  return (
    <>
      <Animated.View style={[styles.flex, shakeStyle]}>
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

          {(showingBox || reelVisible) && box && photo && (
            <>
              {showingBox && (
                <ThemedText themeColor="textSecondary">
                  {stage === 'closed'
                    ? 'You earned this one, so there is no cost to open it. Press and hold the box to charge it, then let go.'
                    : stage === 'charging'
                      ? 'Charging… let go to open.'
                      : 'Opening…'}
                </ThemedText>
              )}
              <View style={styles.stage}>
                {/* Everything on the stage is full screen width (the screen's side padding is
                    cancelled). From the bottom up: the scenery, the reel, and the stage again as a
                    cover with the box on it. The reel is built as soon as the reward is known and
                    kept under the cover, so its pictures are loaded and every card is drawn once
                    (the warm-up sweep) before the spin starts. Building 60 cards, or drawing each
                    for the first time, mid-spin is what made it stutter. The cover is one flat
                    canvas that fades as a whole; a see-through group of 60 cards is slow to draw. */}
                <Animated.View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.layer, { width: windowWidth, height: STAGE_H }, zoomStyle]}>
                  {reel && (
                    <>
                      <SceneryCanvas width={windowWidth} height={STAGE_H} color={sceneColor} clock={clock} glow={afterglow} />
                      <View style={[styles.reelLayer, { width: windowWidth }]}>
                        <CaseReel
                          cards={reel.cards}
                          winnerIndex={reel.winnerIndex}
                          width={windowWidth}
                          landing={reel.landing}
                          durationMs={REEL_SPIN_MS}
                          warmUp={stage === 'bursting'}
                          running={reelVisible && go}
                          popped={popped}
                          onTick={onTick}
                          onLanded={onLanded}
                        />
                      </View>
                    </>
                  )}
                  <Animated.View style={[StyleSheet.absoluteFill, coverStyle]}>
                    <BoxStage
                      type={box.type}
                      width={windowWidth}
                      height={STAGE_H}
                      color={photo.color}
                      clock={clock}
                      glow={charge}
                      blast={blast}
                      shake={kick}
                    />
                  </Animated.View>
                  {stage === 'landed' && look && (
                    <View style={StyleSheet.absoluteFill}>
                      <RevealFx width={windowWidth} height={STAGE_H} color={look.color} gold={gold} trigger={fx} />
                    </View>
                  )}
                </Animated.View>

                {showingBox && (
                  <Pressable
                    disabled={(stage !== 'closed' && stage !== 'charging') || busy}
                    onPressIn={startCharge}
                    onPressOut={release}
                    onPress={() => {
                      // A screen reader's double tap arrives as a plain press, with no hold.
                      if (stage === 'closed' && !held.current) void openAndBlast();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${BOX_LABEL[box.type]}. Press and hold to charge, let go to open.`}
                    accessibilityHint="A quick tap opens it right away"
                    style={styles.boxHit}
                  />
                )}
              </View>
              {stage === 'closed' && (
                <>
                  <Button
                    label="Open"
                    onPress={() => void openAndBlast()}
                    accessibilityHint="Opens the box right away, without holding"
                  />
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
              <View style={styles.center} accessible accessibilityLabel={look.rarityLabel}>
                <Shimmer style={[styles.rarityBar, { borderColor: look.color }]}>
                  <ThemedText type="smallBold" style={{ color: look.color }}>
                    {look.rarityLabel}
                  </ThemedText>
                </Shimmer>
              </View>

              {reward.kind === 'car' && (
                <>
                  <View style={styles.center}>
                    <Turntable carId={reward.carId} color={look.color} size={300} />
                  </View>
                  <View style={styles.center}>
                    <Shimmer style={styles.nameBand} delayMs={600}>
                      <ThemedText type="title" style={styles.centerText}>
                        {getCar(reward.carId).name}
                      </ThemedText>
                    </Shimmer>
                  </View>
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
                  <View style={styles.center}>
                    <Shimmer style={styles.nameBand} delayMs={600}>
                      <ThemedText type="title" style={styles.centerText}>
                        {getPart(reward.partId)!.name}
                      </ThemedText>
                    </Shimmer>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    {RARITY_LABEL[reward.rarity]} {SLOT_LABEL[getPart(reward.partId)!.slot].toLowerCase()} part. Put it on
                    a car in the Mod shop.
                  </ThemedText>
                </>
              )}

              {reward.kind === 'paint' && (
                <>
                  <View style={styles.center}>
                    <PaintSwatch paintId={reward.paintId} />
                  </View>
                  <View style={styles.center}>
                    <Shimmer style={styles.nameBand} delayMs={600}>
                      <ThemedText type="title" style={styles.centerText}>
                        {getPaint(reward.paintId)?.name}
                      </ThemedText>
                    </Shimmer>
                  </View>
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
                  <View style={styles.center}>
                    <Shimmer style={styles.nameBand} delayMs={600}>
                      <ThemedText type="title" style={styles.centerText}>
                        A Golden Crate
                      </ThemedText>
                    </Shimmer>
                  </View>
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
              {!waitingDuplicate && isCar && box.result?.choice !== 'trade' && (
                <ThemedText themeColor="textSecondary" style={styles.centerText} accessibilityLiveRegion="polite">
                  {box.result?.choice === 'keep' ? 'Kept as a separate copy. ' : ''}Added to your garage.
                </ThemedText>
              )}

              {report && (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                  Reel timing (development only): {report.averageFps} fps on average, worst frame {report.worstMs} ms,{' '}
                  {report.slowFrames} of {report.frames} frames over 25 ms.
                  {report.slowAt.length > 0
                    ? ` Slow frames, seconds into the spin: ${report.slowAt.map((s) => `${s.at.toFixed(2)}s (${s.ms} ms)`).join(', ')}.`
                    : ''}
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
      </Animated.View>

      {/* One soft pulse of the rarity color over the whole screen when the reel stops (Common and
          Rare; Epic and Legendary have their own effects). */}
      {look && <FlashLayer color={look.color} trigger={flash} strength={0.3} />}

      {/* Epic: purple lightning. */}
      {look?.rarity === 'epic' && <LightningLayer width={windowWidth} height={STAGE_H * 2} flickers={flickers} trigger={lightning} />}

      {/* Legendary: the screen goes dark for a beat. It never covers the crisis button, which lives
          above every screen, and it lets touches through. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.black, blackoutStyle]} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mute: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', height: STAGE_H },
  // Full screen width (the screen's side padding is cancelled).
  layer: { position: 'absolute', left: -Spacing.four, top: 0 },
  reelLayer: { position: 'absolute', left: 0, top: (STAGE_H - REEL_H) / 2 },
  boxHit: { position: 'absolute', width: 280, height: 260, alignSelf: 'center' },
  black: { backgroundColor: '#000000' },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  underline: { textDecorationLine: 'underline' },
  reveal: { gap: Spacing.three },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  nameBand: { paddingHorizontal: Spacing.four, borderRadius: Radius.chip },
  rarityBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.chip,
    borderWidth: 2,
  },
  choice: { borderRadius: Radius.card, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
});
