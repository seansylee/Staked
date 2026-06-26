import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GoalRow } from '@/components/challenge/GoalRow';
import { StakeSummaryPanel } from '@/components/challenge/StakeSummaryPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { completeChallenge } from '@/api/payments';
import { posthog } from '@/lib/posthog';
import { useCheckIn } from '@/hooks/useCheckIn';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { computeGoalProgress, computeProtection, daysRemainingForChallenge, isChallengeComplete } from '@/utils/protection';
import { formatDateShort, pluralize } from '@/utils/formatting';

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [completing, setCompleting] = useState(false);

  const challenges = useChallengeStore((s) => s.challenges);
  const checkInsMap = useChallengeStore((s) => s.checkInsMap);
  const subscribeToCheckIns = useChallengeStore((s) => s.subscribeToCheckIns);
  const unsubscribeAll = useChallengeStore((s) => s.unsubscribeAll);
  const setChallengeCompleted = useChallengeStore((s) => s.setChallengeCompleted);

  const challenge = challenges.find((c) => c.id === id);
  const checkIns = checkInsMap[id] ?? [];

  const { logCheckIn, loading: checkInLoading } = useCheckIn(id);

  useEffect(() => {
    subscribeToCheckIns(id);
    return () => unsubscribeAll();
  }, [id, subscribeToCheckIns, unsubscribeAll]);

  const summary = useMemo(
    () => challenge ? computeProtection(challenge, checkIns) : null,
    [challenge, checkIns]
  );

  const progress = useMemo(
    () => challenge ? computeGoalProgress(challenge, checkIns) : null,
    [challenge, checkIns]
  );

  const handleComplete = () => {
    Alert.alert(
      'Complete Challenge',
      'This will calculate your final protected amount and process your refund.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setCompleting(true);
            try {
              const completionData = await completeChallenge(id);
              setChallengeCompleted(completionData.challenge);
              posthog.capture('challenge_completed', {
                challenge_id: id,
                protected_cents: completionData.protectedCents,
                forfeited_cents: completionData.forfeitedCents,
              });
              router.replace(`/challenge/${id}/summary`);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Failed to complete challenge';
              Alert.alert('Error', message);
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  if (!challenge || !summary || !progress) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFound}>Challenge not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const daysLeft = daysRemainingForChallenge(challenge);
  const canComplete = isChallengeComplete(challenge);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.challengeName}>{challenge.name}</Text>
          <Badge
            label={canComplete ? 'Complete' : `${pluralize(daysLeft, 'day')}`}
            color={canComplete ? colors.successBg : colors.surfaceHigh}
            textColor={canComplete ? colors.success : colors.textSecondary}
          />
        </View>

        <Text style={styles.dates}>
          {formatDateShort(challenge.start_date)} — {formatDateShort(challenge.end_date)}
        </Text>

        <View style={styles.vaultSection}>
          <StakeSummaryPanel summary={summary} />
        </View>

        <View style={styles.checkInSection}>
          <Text style={styles.sectionLabel}>
            {challenge.target_count}× per {challenge.goal_window}
          </Text>
          <GoalRow
            currentCount={progress.currentCount}
            targetCount={progress.targetCount}
            windowLabel={progress.windowLabel}
            isCompleted={progress.isCompleted}
            onCheckIn={logCheckIn}
            loading={checkInLoading}
          />
        </View>

        {canComplete && (
          <Button
            title="Complete Challenge"
            onPress={handleComplete}
            loading={completing}
            style={styles.completeBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 6 },
  back: { paddingVertical: 12 },
  backText: { fontSize: 22, color: colors.textSecondary },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  challengeName: {
    fontSize: 28,
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.text,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
    flex: 1,
  },
  dates: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  vaultSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  checkInSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingTop: 16,
    paddingBottom: 4,
  },
  completeBtn: { marginTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 15, color: colors.textSecondary },
});
