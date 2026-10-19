import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Night } from '@/constants/theme';

/**
 * The system tab bar, kept as is: four single-word, filled-symbol tabs. The only brand touch
 * is the lamp-colored selected tab.
 */
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Night.background}
      indicatorColor={Night.backgroundElement}
      tintColor={Night.accent}
      labelStyle={{ selected: { color: Night.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Lot</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="car.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="garage">
        <NativeTabs.Trigger.Label>Garage</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="car.2.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="record">
        <NativeTabs.Trigger.Label>Record</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ticket.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
