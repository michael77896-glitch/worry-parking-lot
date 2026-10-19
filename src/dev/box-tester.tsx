import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RARITIES, RARITY_LABEL, type Rarity } from '@/constants/rarity';
import { Radius, Spacing } from '@/constants/theme';
import { addBox } from '@/data';

import { forcedBoxType } from './forced-roll';

async function give(db: SQLiteDatabase, rarity: Rarity) {
  const id = await addBox(db, forcedBoxType(rarity), `dev:${new Date().getTime()}:${rarity}`);
  if (id) router.push({ pathname: '/open-box', params: { id: String(id), force: rarity } });
}

/**
 * Development only: gives you a test box that is guaranteed to hold a chosen rarity, and opens
 * it. Shown on the Garage tab in development builds only; release builds don't include this file.
 */
export function BoxTester() {
  const db = useSQLiteContext();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="headline">Test boxes</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Development only. Each one is a box that holds the rarity you pick, and opens right away.
      </ThemedText>
      {RARITIES.map((rarity) => (
        <Button
          key={rarity}
          label={`Open a ${RARITY_LABEL[rarity]} box`}
          variant={rarity === 'legendary' ? 'primary' : 'secondary'}
          onPress={() => void give(db, rarity)}
        />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
});
