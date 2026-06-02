import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Challenge } from '@/types';
import { daysRemainingForChallenge } from '@/utils/protection';
import { computeProtection } from '@/utils/protection';
import { formatCurrency, pluralize } from '@/utils/formatting';

interface ChallengeCardProps {
  challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const goalsMap = useChallengeStore((s) => s.goalsMap);
  const checkInsMap = useChallengeStore((s) => s.checkInsMap);

  const goals = goalsMap[challenge.id] ?? [];
  const checkIns = checkInsMap[challenge.id] ?? [];

  const summary = useMemo(
    () => computeProtection(challenge, goals, checkIns),
    [challenge, goals, checkIns]
  );

  const daysLeft = daysRemainingForChallenge(challenge);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/challenge/${challenge.id}`)}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name}>{challenge.name}</Text>
          <Text style={styles.daysLeft}>{pluralize(daysLeft, 'day')} left</Text>
        </View>

        <View style={styles.stakeRow}>
          <View style={styles.stakeStat}>
            <Text style={styles.statLabel}>Staked</Text>
            <Text style={styles.statValue}>{formatCurrency(challenge.stake_amount)}</Text>
          </View>
          <View style={styles.stakeStat}>
            <Text style={styles.statLabel}>Protected</Text>
            <Text style={[styles.statValue, styles.green]}>
              {formatCurrency(summary.protectedFunds)}
            </Text>
          </View>
          {summary.fundsAtRisk > 0 && (
            <View style={styles.stakeStat}>
              <Text style={styles.statLabel}>At Risk</Text>
              <Text style={[styles.statValue, styles.red]}>
                {formatCurrency(summary.fundsAtRisk)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>
            Day {summary.elapsedDays} of {summary.totalDays}
          </Text>
          <ProgressBar progress={summary.completionPercent / 100} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  daysLeft: { fontSize: 13, color: '#666', marginLeft: 8 },
  stakeRow: { flexDirection: 'row', gap: 24 },
  stakeStat: { gap: 2 },
  statLabel: { fontSize: 12, color: '#999', fontWeight: '500' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  green: { color: '#16a34a' },
  red: { color: '#dc2626' },
  progressSection: { gap: 6 },
  progressLabel: { fontSize: 12, color: '#999' },
});
