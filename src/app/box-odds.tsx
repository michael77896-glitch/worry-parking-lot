import { StyleSheet, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { BoxArt } from '@/components/lot/box-art';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { droppableCars } from '@/constants/car-data';
import { COLOR_SHIFT_PAINTS } from '@/constants/paints';
import { PARTS } from '@/constants/parts';
import { RARITIES, RARITY_COLOR, RARITY_COLOR_NAME, RARITY_LABEL } from '@/constants/rarity';
import {
  BOX_EARNED_BY,
  BOX_LABEL,
  GOLDEN_CHANCE,
  KIND_WEIGHTS,
  PITY_EVERY,
  PITY_WEIGHTS,
  RARITY_WEIGHTS,
  TOKENS,
  type BoxType,
} from '@/constants/rewards';
import { Radius, Spacing } from '@/constants/theme';

const TYPES: BoxType[] = ['glovebox', 'toolbox', 'golden'];

/** "2%", "0.5%". Trims a trailing .0. */
function percent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function RarityRows({ weights }: { weights: Record<(typeof RARITIES)[number], number> }) {
  return (
    <>
      {RARITIES.filter((r) => weights[r] > 0).map((r) => (
        <View key={r} style={styles.rarityRow} accessible accessibilityLabel={`${RARITY_LABEL[r]}, ${percent(weights[r])}`}>
          <View style={[styles.dot, { backgroundColor: RARITY_COLOR[r] }]} />
          <ThemedText style={styles.grow}>
            {RARITY_LABEL[r]} <ThemedText type="small" themeColor="textSecondary">({RARITY_COLOR_NAME[r]})</ThemedText>
          </ThemedText>
          <ThemedText type="smallBold">{percent(weights[r])}</ThemedText>
        </View>
      ))}
    </>
  );
}

/**
 * Boxes, honestly. Every number here is read from src/constants/rewards.ts, the same table the
 * game rolls from, so the screen can't drift from the real odds.
 */
export default function BoxOddsScreen() {
  const carsByRarity = Object.fromEntries(RARITIES.map((r) => [r, droppableCars(r).length])) as Record<(typeof RARITIES)[number], number>;
  const missing = RARITIES.filter((r) => carsByRarity[r] === 0);

  return (
    <Screen>
      <BackLink />
      <ThemedText type="subtitle">Boxes and odds</ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline">Boxes are only ever earned</ThemedText>
        <ThemedText themeColor="textSecondary">
          You can&apos;t buy a box with real money, now or ever. Nothing here resets, runs out, or gets
          taken away, and there are no streaks to keep up.
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline">Tokens</ThemedText>
        <ThemedText themeColor="textSecondary">
          +{TOKENS.park} for parking a worry (the first {TOKENS.parkPerDay} each day). +{TOKENS.window} for
          finishing a worry window. +{TOKENS.outcome} for each &quot;Did this actually happen?&quot; answer,
          whichever answer it is. Spend them in the Mod shop on paint and parts.
        </ThemedText>
      </ThemedView>

      {TYPES.map((type) => (
        <ThemedView key={type} type="backgroundElement" style={styles.card}>
          <View style={styles.boxHeader}>
            <BoxArt type={type} width={56} />
            <ThemedText type="title" style={styles.grow} accessibilityRole="header">
              {BOX_LABEL[type]}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">
            {BOX_EARNED_BY[type]}
          </ThemedText>

          {type !== 'golden' && (
            <ThemedText>
              <ThemedText type="smallBold">{percent(GOLDEN_CHANCE[type] * 100)}</ThemedText> of the time, opening
              it gives a Golden Crate instead of its usual contents.
            </ThemedText>
          )}

          <ThemedText type="smallBold">What rarity</ThemedText>
          <RarityRows weights={RARITY_WEIGHTS[type]} />

          <ThemedText type="smallBold">What kind of thing</ThemedText>
          <ThemedText themeColor="textSecondary">
            {percent(KIND_WEIGHTS[type].car)} a car, {percent(KIND_WEIGHTS[type].part)} a mod part
            {KIND_WEIGHTS[type].paint > 0 ? `, ${percent(KIND_WEIGHTS[type].paint)} a color-shift paint` : ''}.
            {type === 'golden' ? ' Golden Crates always hold something Epic or better.' : ''}
          </ThemedText>
        </ThemedView>
      ))}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline">Guaranteed Epic</ThemedText>
        <ThemedText themeColor="textSecondary">
          Every {PITY_EVERY}th box you open is guaranteed to be Epic or better (a Golden Crate counts), unless
          you already got one in the last {PITY_EVERY - 1} boxes. Any Epic or better resets the count. When it
          is guaranteed, the odds are {percent(PITY_WEIGHTS.epic)} Epic and {percent(PITY_WEIGHTS.legendary)} Legendary.
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline">What exists right now</ThemedText>
        <ThemedText themeColor="textSecondary">
          Cars you can get: {RARITIES.map((r) => `${carsByRarity[r]} ${RARITY_LABEL[r]}`).join(', ')}. Mod parts:{' '}
          {PARTS.length} (every rarity). Color-shift paints: {COLOR_SHIFT_PAINTS.length}, from Golden Crates only.
        </ThemedText>
        {missing.length > 0 && (
          <ThemedText themeColor="textSecondary">
            There are no {missing.map((r) => RARITY_LABEL[r]).join(', ')} cars yet. If a roll lands on a car or
            paint that doesn&apos;t exist yet, you get a mod part of that same rarity instead. New cars will
            join the boxes as they&apos;re added.
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline">Cars you already have</ThemedText>
        <ThemedText themeColor="textSecondary">
          If a box gives a car you already own, you choose: keep it as a separate copy that you can paint and
          mod on its own, or trade it for a Glovebox.
        </ThemedText>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
  boxHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  grow: { flex: 1 },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 32 },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
