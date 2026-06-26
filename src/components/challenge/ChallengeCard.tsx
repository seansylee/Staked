import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Challenge } from '@/types';
import { formatCurrency, pluralize } from '@/utils/formatting';
import { computeDashboardStatus, computeProtection, daysRemainingForChallenge } from '@/utils/protection';

interface ChallengeCardProps {
  challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const checkInsMap = useChallengeStore((s) => s.checkInsMap);
  const checkIns = checkInsMap[challenge.id] ?? [];

  const summary = useMemo(
    () => computeProtection(challenge, checkIns),
    [challenge, checkIns]
  );

  const status = useMemo(
    () => computeDashboardStatus(challenge, checkIns),
    [challenge, checkIns]
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

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amount}>{formatCurrency(summary.protectedFunds)}</Text>
          <Text style={styles.amountLabel}>protected</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusEmoji}>{status.emoji}</Text>
          <Text style={styles.statusText}>{status.statusText}</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <ProgressBar
          progress={summary.completionPercent / 100}
          height={2}
          color={colors.white}
          backgroundColor={colors.border}
        />
      </View>

      {status.nudge && (
        <View style={styles.nudgeBox}>
          <View style={styles.nudgeRow}>
            <Text style={styles.nudgeDot}>·</Text>
            <Text style={styles.nudgeText}>
              <Text style={styles.nudgeNeeded}>{status.nudge.needed}×</Text>
              <Text style={styles.nudgeDeadline}> by {status.nudge.deadline}</Text>
              <Text style={styles.nudgeRisk}>  {formatCurrency(status.nudge.atRiskCents)} at stake</Text>
            </Text>
          </View>
        </View>
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amount: {
    fontSize: 36,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '500',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginBottom: 2,
  },
  statusEmoji: { fontSize: 13 },
  statusText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  progressSection: { marginTop: 10, marginBottom: 4 },
  nudgeBox: { marginTop: 8 },
  nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nudgeDot: { fontSize: 12, color: colors.textMuted },
  nudgeText: { fontSize: 12, color: colors.textSecondary },
  nudgeNeeded: { fontSize: 12, fontWeight: '700', color: colors.text },
  nudgeDeadline: { fontSize: 12, color: colors.textMuted },
  nudgeRisk: { fontSize: 12, color: '#A07840' },
});
