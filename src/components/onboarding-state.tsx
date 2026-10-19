import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getOnboardingDone, saveOnboardingDone } from '@/data';

type OnboardingState = {
  /** null while the saved value is still loading. */
  onboarded: boolean | null;
  complete: () => Promise<void>;
  /** Sends the user back to the walkthrough, e.g. after they delete all their data. */
  reset: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getOnboardingDone(db).then((done) => {
      if (active) setOnboarded(done);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const complete = useCallback(async () => {
    await saveOnboardingDone(db);
    setOnboarded(true);
  }, [db]);

  const reset = useCallback(() => setOnboarded(false), []);

  return (
    <OnboardingContext.Provider value={{ onboarded, complete, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return value;
}
