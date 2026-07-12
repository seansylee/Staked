import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { Challenge } from '@/types';

export function RefundStatusNote({ challenge }: { challenge: Challenge }) {
  if ((challenge.protected_amount_cents ?? 0) === 0) return null;

  if (challenge.refund_status === 'failed') {
    return (
      <View style={styles.failedBox}>
        <Text style={styles.failedTitle}>Refund failed</Text>
        <Text style={styles.failedBody}>
          Your money is safe, but the refund didn&apos;t go through. Contact support and
          we&apos;ll sort it out.
        </Text>
      </View>
    );
  }
  if (challenge.refund_status === 'pending') {
    return (
      <Text style={styles.note}>
        Refund processing — funds typically appear in 5–10 business days.
      </Text>
    );
  }
  if (challenge.refund_status === 'succeeded') {
    return (
      <Text style={[styles.note, styles.succeeded]}>
        ✓ Refund sent to your original payment method.
      </Text>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 8 },
  succeeded: { color: colors.success },
  failedBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 14,
    gap: 4,
  },
  failedTitle: { fontSize: 13, fontWeight: '700', color: colors.danger },
  failedBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
