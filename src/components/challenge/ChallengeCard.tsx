import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Challenge } from '@/types';
import { formatCurrency, pluralize } from '@/utils/formatting';
import { computeProtection, daysRemainingForChallenge } from '@/utils/protection';

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
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/challenge/${challenge.id}`)}
    >
      <View style={styles.top}>
        <Text style={styles.name}>{challenge.name}</Text>
        <Text style={styles.days}>{pluralize(daysLeft, 'day')} left</Text>
      </View>

      <Text style={styles.amount}>{formatCurrency(summary.protectedFunds)}</Text>
      <Text style={styles.amountLabel}>protected</Text>

      <View style={styles.progressSection}>
        <ProgressBar
          progress={summary.completionPercent / 100}
          height={2}
          color={colors.white}
          backgroundColor={colors.border}
        />
      </View>

      {summary.fundsAtRisk > 0 && (
        <Text style={styles.atRisk}>{formatCurrency(summary.fundsAtRisk)} at risk</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  days: { fontSize: 12, color: colors.textSecondary },
  amount: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -1.5 },
  amountLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '500',
    marginBottom: 14,
  },
  progressSection: {},
  atRisk: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 8,
    fontWeight: '500',
  },
});
