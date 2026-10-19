import { useEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

export type FrameReport = {
  frames: number;
  averageFps: number;
  worstMs: number;
  slowFrames: number;
  /** The first slow frames: how many seconds into the measurement, and how long each took. */
  slowAt: { at: number; ms: number }[];
};

const MAX_LOGGED = 10;

/**
 * Development only (required behind `__DEV__`, so release builds don't contain it). Measures how
 * long each screen frame takes while `active` is true, so a choppy animation can be described with
 * numbers instead of "it stutters". A smooth animation has a worst frame near the frame time (17 ms
 * at 60 fps, 8 ms at 120) and no frames over 25 ms; a frame over 25 ms is a visible hitch. The
 * report also says when the first slow frames happened, which shows what caused them: at the very
 * start (the screen changing), in step with the ticks (haptics and sound), or at the end.
 */
export function useFrameMeter(active: boolean) {
  const frames = useSharedValue(0);
  const totalMs = useSharedValue(0);
  const worstMs = useSharedValue(0);
  const slow = useSharedValue(0);
  const log = useSharedValue<number[]>([]);

  const callback = useFrameCallback((frame) => {
    'worklet';
    const dt = frame.timeSincePreviousFrame;
    if (!dt) return;
    frames.set(frames.get() + 1);
    totalMs.set(totalMs.get() + dt);
    if (dt > worstMs.get()) worstMs.set(dt);
    if (dt > 25) {
      slow.set(slow.get() + 1);
      if (log.get().length < MAX_LOGGED * 2) log.set([...log.get(), Math.round(totalMs.get()), Math.round(dt)]);
    }
  }, false);

  useEffect(() => {
    callback.setActive(active);
  }, [active, callback]);

  return {
    reset() {
      frames.set(0);
      totalMs.set(0);
      worstMs.set(0);
      slow.set(0);
      log.set([]);
    },
    read(): FrameReport {
      const n = frames.get();
      const flat = log.get();
      const slowAt: FrameReport['slowAt'] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) slowAt.push({ at: flat[i] / 1000, ms: flat[i + 1] });
      return {
        frames: n,
        averageFps: n > 0 ? Math.round((n / totalMs.get()) * 1000) : 0,
        worstMs: Math.round(worstMs.get()),
        slowFrames: slow.get(),
        slowAt,
      };
    },
  };
}
