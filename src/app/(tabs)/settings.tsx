import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { DISCLAIMER } from '@/constants/copy';

/** Placeholder. Window editing and data deletion arrive in build step 9. */
export default function SettingsScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Settings</ThemedText>
      <ThemedText type="smallBold">About this app</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {DISCLAIMER}
      </ThemedText>
    </Screen>
  );
}
