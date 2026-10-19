import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the iPhone's Increase Contrast ("Darker System Colors") setting is on.
 *
 * Every piece of text and every themed view reads this, so there is ONE shared subscription for the
 * whole app. (It used to be one per component, which meant hundreds of native calls and listeners
 * when a screen with many cards, like the box-opening reel, appeared.)
 */
let current = false;
let started = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  if (value === current) return;
  current = value;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  AccessibilityInfo.isDarkerSystemColorsEnabled()
    .then(set)
    .catch(() => {});
  AccessibilityInfo.addEventListener('darkerSystemColorsChanged', set);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIncreasedContrast(): boolean {
  return useSyncExternalStore(subscribe, () => current, () => false);
}
