import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getStats, listReviewed, type HistoryItem, type Outcome, type Stats } from '@/data';
import { formatDateTime } from '@/utils/format';

const OUTCOME_LABEL: Record<Outcome, string> = {
  happened: 'Happened',
  partly: 'Partly happened',
  did_not_happen: "Didn't happen",
};

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText>{label}</ThemedText>
      <ThemedText type="subtitle" style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const status = item.outcome
    ? OUTCOME_LABEL[item.outcome]
    : `Look back on ${formatDateTime(new Date(item.followUpDueAt))}`;
  return (
    <ThemedView type="backgroundElement" style={styles.historyRow}>
      <ThemedText numberOfLines={4}>{item.text}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Parked {formatDateTime(new Date(item.parkedAt))}
      </ThemedText>
      <ThemedText type="smallBold">{status}</ThemedText>
    </ThemedView>
  );
}

/**
 * A plain record of what happened to the worries the user parked. Counts only, no scores,
 * percentages, or advice. Lists reviewed worries (their text is readable once reviewed).
 */
export default function RecordScreen() {
  const db = useSQLiteContext();
  const [data, setData] = useState<{ stats: Stats; history: HistoryItem[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [stats, history] = await Promise.all([getStats(db), listReviewed(db)]);
        if (active) setData({ stats, history });
      })();
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Your record</ThemedText>
      {data && (
        <>
          <ThemedView type="backgroundElement" style={styles.card}>
            <StatRow label="Worries parked" value={data.stats.parked} />
            <StatRow label="Looked back on" value={data.stats.lookedBack} />
            <StatRow label="Happened" value={data.stats.happened} />
            <StatRow label="Partly happened" value={data.stats.partly} />
            <StatRow label="Didn't happen" value={data.stats.didNotHappen} />
          </ThemedView>

          {data.history.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Nothing to show yet. Once you&apos;ve reviewed a worry and looked back on it a week
              after you parked it, what happened is recorded here.
            </ThemedText>
          ) : (
            <>
              <ThemedText type="smallBold" accessibilityRole="header">
                Past worries
              </ThemedText>
              {data.history.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontSize: 24, lineHeight: 32 },
  historyRow: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
});
