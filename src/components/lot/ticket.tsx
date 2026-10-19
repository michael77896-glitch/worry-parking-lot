import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Small label above the main value, e.g. "Gate opens for you". */
  label: string;
  /** The main line, e.g. "Thursday 7:00 PM". */
  value: string;
  note?: string;
  /** Printed top right, e.g. "Space 3". */
  code?: string;
  /** Torn-off stub details at the bottom. */
  stub?: { label: string; value: string }[];
};

/**
 * A parking ticket on cream paper, with a perforated stub. The notches are circles in the
 * screen's own background color, so only use it on the plain asphalt background.
 */
export function ParkingTicket({ label, value, note, code, stub }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.ticket, { backgroundColor: theme.ticket }]}>
      <View style={styles.top}>
        <View style={styles.header}>
          <ThemedText type="caption" themeColor="ticketTextSecondary" style={styles.heading}>
            PARKING TICKET
          </ThemedText>
          {code && (
            <ThemedText type="caption" themeColor="ticketTextSecondary" style={styles.code}>
              {code}
            </ThemedText>
          )}
        </View>
        <ThemedText type="small" themeColor="ticketTextSecondary">
          {label}
        </ThemedText>
        <ThemedText type="title" themeColor="ticketText">
          {value}
        </ThemedText>
        {note && (
          <ThemedText type="small" themeColor="ticketTextSecondary">
            {note}
          </ThemedText>
        )}
      </View>

      {stub && stub.length > 0 && (
        <>
          <View style={styles.perforation} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.notch, styles.notchLeft, { backgroundColor: theme.background }]} />
            <View style={[styles.notch, styles.notchRight, { backgroundColor: theme.background }]} />
            <Svg width="100%" height="2" style={styles.dash}>
              <Line
                x1="14"
                y1="1"
                x2="9999"
                y2="1"
                stroke={theme.ticketTextSecondary}
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity="0.55"
              />
            </Svg>
          </View>
          <View style={styles.stub}>
            {stub.map((row) => (
              <View key={row.label} style={styles.stubRow}>
                <ThemedText type="caption" themeColor="ticketTextSecondary">
                  {row.label}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="ticketText">
                  {row.value}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  top: { padding: 20, gap: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  heading: { letterSpacing: 1.4 },
  code: { fontFamily: Fonts.mono, fontWeight: 600 },
  perforation: { height: 20, justifyContent: 'center' },
  dash: { position: 'absolute', left: 0, right: 0, top: 9 },
  notch: { position: 'absolute', top: 0, width: 20, height: 20, borderRadius: 10 },
  notchLeft: { left: -10 },
  notchRight: { right: -10 },
  stub: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18, gap: 8 },
  stubRow: { gap: 1 },
});
