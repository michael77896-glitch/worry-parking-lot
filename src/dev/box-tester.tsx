import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RARITIES, RARITY_LABEL, type Rarity } from '@/constants/rarity';
import type { BoxType } from '@/constants/rewards';
import { Radius, Spacing } from '@/constants/theme';
import { addBox } from '@/data';

import { forcedBoxType } from './forced-roll';
import { ReelLab } from './reel-lab';

async function give(db: SQLiteDatabase, rarity: Rarity) {
  const id = await addBox(db, forcedBoxType(rarity), `dev:${new Date().getTime()}:${rarity}`);
  if (id) router.push({ pathname: '/open-box', params: { id: String(id), force: rarity } });
}

/** Adds ten ordinary boxes (they use the real odds): 5 Gloveboxes, 3 Toolboxes, 2 Golden Crates. */
async function addTen(db: SQLiteDatabase, onDone: () => void) {
  const stamp = new Date().getTime();
  const plan: BoxType[] = ['glovebox', 'glovebox', 'glovebox', 'glovebox', 'glovebox', 'toolbox', 'toolbox', 'toolbox', 'golden', 'golden'];
  for (let i = 0; i < plan.length; i++) await addBox(db, plan[i], `dev:${stamp}:more:${i}`);
  onDone();
}

/**
 * Development only: gives you a test box that is guaranteed to hold a chosen rarity, and opens
 * it. Shown on the Garage tab in development builds only; release builds don't include this file.
 */
export function BoxTester() {
  const db = useSQLiteContext();
  const [added, setAdded] = useState(false);

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
      <ThemedText type="small" themeColor="textSecondary">
        Or add boxes that use the real odds, and open them from the Boxes list above.
      </ThemedText>
      <Button
        label={added ? 'Added 10 boxes. Look in the Boxes list.' : 'Add 10 boxes'}
        variant="secondary"
        onPress={() => void addTen(db, () => setAdded(true))}
      />
      <ReelLab />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
});
