import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the iPhone's Increase Contrast ("Darker System Colors") setting is on. */
export function useIncreasedContrast(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isDarkerSystemColorsEnabled().then((value) => {
      if (active) setOn(value);
    });
    const subscription = AccessibilityInfo.addEventListener('darkerSystemColorsChanged', setOn);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return on;
}
