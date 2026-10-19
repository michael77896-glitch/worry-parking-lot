import { useEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

export type FrameReport = { frames: number; averageFps: number; worstMs: number; slowFrames: number };

/**
 * Development only (required behind `__DEV__`, so release builds don't contain it). Measures how
 * long each screen frame takes while `active` is true, so a choppy animation can be described with
 * numbers instead of "it stutters". A smooth 60 fps animation has a worst frame near 17 ms and no
 * slow frames; anything over 25 ms is a visible hitch.
 */
export function useFrameMeter(active: boolean) {
  const frames = useSharedValue(0);
  const totalMs = useSharedValue(0);
  const worstMs = useSharedValue(0);
  const slow = useSharedValue(0);

  const callback = useFrameCallback((frame) => {
    'worklet';
    const dt = frame.timeSincePreviousFrame;
    if (!dt) return;
    frames.set(frames.get() + 1);
    totalMs.set(totalMs.get() + dt);
    if (dt > worstMs.get()) worstMs.set(dt);
    if (dt > 25) slow.set(slow.get() + 1);
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
    },
    read(): FrameReport {
      const n = frames.get();
      return {
        frames: n,
        averageFps: n > 0 ? Math.round((n / totalMs.get()) * 1000) : 0,
        worstMs: Math.round(worstMs.get()),
        slowFrames: slow.get(),
      };
    },
  };
}
