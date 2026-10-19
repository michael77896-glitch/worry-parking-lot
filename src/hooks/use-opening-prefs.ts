import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getQuickOpening, getSoundEnabled, saveQuickOpening, saveSoundEnabled } from '@/data';

/**
 * The two box-opening settings, kept on the phone: sound effects (on until muted) and quick
 * opening (off until turned on, skips the reel). `loaded` is false until they have been read.
 */
export function useOpeningPrefs() {
  const db = useSQLiteContext();
  const [sound, setSoundState] = useState(true);
  const [quick, setQuickState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getSoundEnabled(db), getQuickOpening(db)]).then(([s, q]) => {
      if (!active) return;
      setSoundState(s);
      setQuickState(q);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const setSound = useCallback(
    (on: boolean) => {
      setSoundState(on);
      void saveSoundEnabled(db, on);
    },
    [db],
  );

  const setQuick = useCallback(
    (on: boolean) => {
      setQuickState(on);
      void saveQuickOpening(db, on);
    },
    [db],
  );

  return { sound, quick, loaded, setSound, setQuick };
}
