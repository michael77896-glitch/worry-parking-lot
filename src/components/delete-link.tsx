import { Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** A small "Delete" control that asks for confirmation before calling `onConfirmed`. */
export function DeleteLink({ onConfirmed }: { onConfirmed: () => void | Promise<void> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Delete this worry"
      hitSlop={8}
      style={styles.link}
      onPress={() =>
        Alert.alert(
          'Delete this worry?',
          'It will be permanently removed from this phone. This can’t be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void onConfirmed() },
          ],
        )
      }>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        Delete
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  text: { textDecorationLine: 'underline' },
});
