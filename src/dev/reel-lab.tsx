import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { CARD_H, CaseReel, REEL_SPIN_MS } from '@/components/lot/reel';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { buildReel, type Reward } from '@/data';
import { createSfx, tickHaptic } from '@/utils/feedback';

import { useFrameMeter, type FrameReport } from './frame-meter';

type Config = { label: string; plain: boolean; haptics: boolean; sound: boolean };

/** Each run changes one thing, so a difference between two runs points at what caused it. */
const CONFIGS: Config[] = [
  { label: '1. Plain cards, no ticks', plain: true, haptics: false, sound: false },
  { label: '2. Real cards, no ticks', plain: false, haptics: false, sound: false },
  { label: '3. Real cards + tick haptics', plain: false, haptics: true, sound: false },
  { label: '4. Real cards + tick sounds', plain: false, haptics: false, sound: true },
  { label: '5. Real cards + both (a real opening)', plain: false, haptics: true, sound: true },
];

const WARM_MS = 900;
const PAUSE_MS = 700;
const WINNER: Reward = { kind: 'part', partId: 'rims-steel', rarity: 'common' };
const REEL_HEIGHT = CARD_H + 52;

/**
 * Development only. Runs the reel five times in a row, switching one thing on or off each time:
 * pictures, haptic ticks, and sound ticks. Each run has its own frame report, so a stutter can be
 * traced to the cards, the haptics, or the sound instead of guessed at. It doesn't open any
 * boxes and changes nothing in your data.
 */
export function ReelLab() {
  const { width } = useWindowDimensions();
  const [reel] = useState(() => buildReel('glovebox', WINNER));
  const [run, setRun] = useState(-1);
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState<{ label: string; report: FrameReport }[]>([]);
  const meter = useFrameMeter(spinning);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sfx = useRef<ReturnType<typeof createSfx> | null>(null);
  const lastHaptic = useRef(0);
  const lastSound = useRef(0);

  useEffect(() => {
    sfx.current = createSfx();
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      sfx.current?.release();
      sfx.current = null;
    };
  }, []);

  function later(ms: number, fn: () => void) {
    timers.current.push(setTimeout(fn, ms));
  }

  function startRun(i: number) {
    if (i >= CONFIGS.length) {
      setRun(-1);
      return;
    }
    setSpinning(false);
    setRun(i); // a new key remounts the reel, like opening a fresh box
    sfx.current?.warmUp();
    later(WARM_MS, () => {
      meter.reset();
      setSpinning(true);
    });
  }

  function start() {
    setResults([]);
    startRun(0);
  }

  const config = run >= 0 ? CONFIGS[run] : null;

  function onTick() {
    const now = Date.now();
    if (config?.haptics && now - lastHaptic.current >= 90) {
      lastHaptic.current = now;
      tickHaptic();
    }
    if (config?.sound && now - lastSound.current >= 150) {
      lastSound.current = now;
      sfx.current?.play('tick');
    }
  }

  function onLanded() {
    if (run < 0) return;
    const finished = run;
    setResults((all) => [...all, { label: CONFIGS[finished].label, report: meter.read() }]);
    setSpinning(false);
    later(PAUSE_MS, () => startRun(finished + 1));
  }

  return (
    <View style={styles.lab}>
      <ThemedText type="headline">Reel lab</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Development only. Runs the reel 5 times (about 30 seconds), changing one thing each time, and
        reports the frame timing of each. Send me the numbers.
      </ThemedText>
      <Button
        label={run >= 0 ? `Running ${run + 1} of ${CONFIGS.length}…` : 'Run the reel lab'}
        disabled={run >= 0}
        variant="secondary"
        onPress={start}
      />

      {run >= 0 && config && (
        // Cancels the card's padding and the screen's, so the reel spans the whole screen.
        <View style={{ marginHorizontal: -Spacing.four * 2, width, height: REEL_HEIGHT }}>
          <CaseReel
            key={run}
            cards={reel.cards}
            winnerIndex={reel.winnerIndex}
            width={width}
            landing={0.1}
            durationMs={REEL_SPIN_MS}
            warmUp={!spinning}
            running={spinning}
            popped={false}
            plain={config.plain}
            onTick={onTick}
            onLanded={onLanded}
          />
        </View>
      )}

      {results.map(({ label, report }) => (
        <View key={label} style={styles.result}>
          <ThemedText type="smallBold">{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {report.averageFps} fps on average · worst frame {report.worstMs} ms · {report.slowFrames} of{' '}
            {report.frames} frames over 25 ms
            {report.slowAt.length > 0
              ? ` (at ${report.slowAt.map((s) => `${s.at.toFixed(1)}s ${s.ms}ms`).join(', ')})`
              : ''}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lab: { gap: Spacing.three },
  result: { gap: Spacing.half },
});
