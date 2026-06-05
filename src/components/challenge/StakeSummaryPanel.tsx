import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors } from '@/constants/theme';
import { ProtectionSummary } from '@/types';
import { formatCurrency } from '@/utils/formatting';

interface StakeSummaryPanelProps {
  summary: ProtectionSummary;
}

export function StakeSummaryPanel({ summary }: StakeSummaryPanelProps) {
  const protectedPct = summary.originalStake > 0
    ? summary.protectedFunds / summary.originalStake
    : 1;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Protected</Text>
      <Text style={styles.bigAmount}>{formatCurrency(summary.protectedFunds)}</Text>

      <ProgressBar
        progress={protectedPct}
        height={3}
        color={colors.success}
        backgroundColor={colors.border}
      />

      <View style={styles.row}>
        <Stat label="Staked" value={formatCurrency(summary.originalStake)} />
        <Stat
          label="At Risk"
          value={formatCurrency(summary.fundsAtRisk)}
          valueColor={summary.fundsAtRisk > 0 ? colors.danger : colors.textSecondary}
        />
        <Stat label="Day" value={`${summary.elapsedDays} / ${summary.totalDays}`} />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  valueColor = colors.text,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bigAmount: {
    fontSize: 52,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
    marginTop: -4,
  },
  row: {
    flexDirection: 'row',
    gap: 28,
    paddingTop: 4,
  },
  stat: { gap: 3 },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
