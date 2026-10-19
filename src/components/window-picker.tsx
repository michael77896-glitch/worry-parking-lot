import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dateFromMinutes } from '@/utils/format';

const LENGTH_PRESETS = [10, 15, 20, 30, 45, 60];

type Props = {
  startMinutes: number;
  lengthMinutes: number;
  onStartChange: (minutes: number) => void;
  onLengthChange: (minutes: number) => void;
};

/** Time-of-day and length controls for the daily worry window. Used in setup and onboarding. */
export function WindowPicker({ startMinutes, lengthMinutes, onStartChange, onLengthChange }: Props) {
  const theme = useTheme();
  const lengths = Array.from(new Set([...LENGTH_PRESETS, lengthMinutes])).sort((a, b) => a - b);

  return (
    <>
      <ThemedText type="smallBold" accessibilityRole="header">
        Opens at
      </ThemedText>
      <View style={styles.picker}>
        <DateTimePicker
          value={dateFromMinutes(startMinutes)}
          mode="time"
          display="spinner"
          onChange={(_event, date) => {
            if (date) onStartChange(date.getHours() * 60 + date.getMinutes());
          }}
          accessibilityLabel="Time your worry window opens"
        />
      </View>

      <ThemedText type="smallBold" accessibilityRole="header">
        Stays open for
      </ThemedText>
      <View style={styles.chips}>
        {lengths.map((m) => {
          const selected = m === lengthMinutes;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`${m} minutes`}
              accessibilityState={{ selected }}
              onPress={() => onLengthChange(m)}
              style={[
                styles.chip,
                { backgroundColor: selected ? theme.accent : theme.backgroundElement },
              ]}>
              <ThemedText type="smallBold" themeColor={selected ? 'accentText' : 'text'}>
                {m} min
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  picker: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    justifyContent: 'center',
  },
});
