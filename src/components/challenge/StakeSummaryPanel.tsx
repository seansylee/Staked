import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProtectionSummary } from '@/types';
import { formatCurrency } from '@/utils/formatting';

interface StakeSummaryPanelProps {
  summary: ProtectionSummary;
}

export function StakeSummaryPanel({ summary }: StakeSummaryPanelProps) {
  const protectedPercent = summary.originalStake > 0
    ? summary.protectedFunds / summary.originalStake
    : 1;

  return (
    <Card>
      <Text style={styles.title}>Vault</Text>

      <View style={styles.mainAmount}>
        <Text style={styles.protectedLabel}>Protected</Text>
        <Text style={styles.protectedAmount}>{formatCurrency(summary.protectedFunds)}</Text>
      </View>

      <ProgressBar
        progress={protectedPercent}
        height={8}
        color="#16a34a"
        backgroundColor="#fee2e2"
      />

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Original Stake</Text>
          <Text style={styles.statValue}>{formatCurrency(summary.originalStake)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>At Risk</Text>
          <Text style={[styles.statValue, summary.fundsAtRisk > 0 && styles.red]}>
            {formatCurrency(summary.fundsAtRisk)}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Progress</Text>
          <Text style={styles.statValue}>
            {summary.elapsedDays}/{summary.totalDays}d
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  mainAmount: { marginBottom: 12 },
  protectedLabel: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginBottom: 2 },
  protectedAmount: { fontSize: 36, fontWeight: '800', color: '#1a1a1a', letterSpacing: -1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  stat: { gap: 2 },
  statLabel: { fontSize: 11, color: '#999', fontWeight: '500' },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  red: { color: '#dc2626' },
});
