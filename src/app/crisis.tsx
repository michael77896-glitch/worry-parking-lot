import { Alert, Linking, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CRISIS } from '@/constants/crisis';
import { DISCLAIMER } from '@/constants/copy';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** Opens a phone, text, or web link. If the device can't, tells the user what to do by hand. */
async function open(url: string, fallback: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open that", fallback);
  }
}

export default function CrisisScreen() {
  const { lifeline, emergency, crisisTextLine, international } = CRISIS;

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <ThemedText type="default">
          If you are in crisis or thinking about hurting yourself, you don&apos;t have to handle it
          alone. Free, confidential support is available right now.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            {lifeline.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Free, 24 hours a day, 7 days a week, in the US. Call or text {lifeline.number}.
          </ThemedText>
          <Button
            variant="crisis"
            label={`Call ${lifeline.number}`}
            accessibilityHint="Starts a phone call to the 988 Suicide and Crisis Lifeline"
            onPress={() => open(lifeline.callUrl, `Dial ${lifeline.number} on your phone.`)}
          />
          <Button
            variant="secondary"
            label={`Text ${lifeline.number}`}
            accessibilityHint="Opens a text message to 988"
            onPress={() => open(lifeline.textUrl, `Text ${lifeline.number} from your messages app.`)}
          />
          <Button
            variant="secondary"
            label="Chat online"
            accessibilityHint="Opens the 988 chat in your browser. Needs an internet connection."
            onPress={() => open(lifeline.chatUrl, 'Go to 988lifeline.org/chat in your browser.')}
          />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            In immediate danger
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            If you or someone else is in danger right now, call emergency services.
          </ThemedText>
          <Button
            variant="crisis"
            label={`Call ${emergency.number}`}
            accessibilityHint="Starts a phone call to emergency services"
            onPress={() => open(emergency.callUrl, `Dial ${emergency.number} on your phone.`)}
          />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            {crisisTextLine.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Prefer texting? Text {crisisTextLine.keyword} to {crisisTextLine.shortcode} (US).
          </ThemedText>
          <Button
            variant="secondary"
            label={`Text ${crisisTextLine.keyword} to ${crisisTextLine.shortcode}`}
            accessibilityHint="Opens a text message to the Crisis Text Line"
            onPress={() =>
              open(
                crisisTextLine.textUrl,
                `Text ${crisisTextLine.keyword} to ${crisisTextLine.shortcode} from your messages app.`,
              )
            }
          />
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary">
          Outside the US? Find a helpline in your country at {international.url.replace('https://', '')}.
        </ThemedText>
        <Button
          variant="secondary"
          label={international.name}
          accessibilityHint="Opens a directory of helplines in your browser. Needs an internet connection."
          onPress={() => open(international.url, `Go to ${international.url} in your browser.`)}
        />

        <ThemedText type="small" themeColor="textSecondary">
          {DISCLAIMER}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 22, lineHeight: 28 },
});
