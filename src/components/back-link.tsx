import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** Back control for pushed screens, which hide the native header so the crisis button stays clear. */
export function BackLink() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      hitSlop={8}
      style={styles.back}>
      <ThemedText type="default" themeColor="accent">
        ‹ Back
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
