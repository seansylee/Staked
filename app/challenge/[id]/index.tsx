import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GoalRow } from '@/components/challenge/GoalRow';
import { StakeSummaryPanel } from '@/components/challenge/StakeSummaryPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { completeChallenge } from '@/api/payments';
import { posthog } from '@/lib/posthog';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useChallengeStore } from '@/store/useChallengeStore';
import { computeGoalProgress, computeProtection, daysRemainingForChallenge, isChallengeComplete } from '@/utils/protection';
import { formatDateShort, pluralize } from '@/utils/formatting';

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [completing, setCompleting] = useState(false);

  const challenges = useChallengeStore((s) => s.challenges);
  const goalsMap = useChallengeStore((s) => s.goalsMap);
  const checkInsMap = useChallengeStore((s) => s.checkInsMap);
  const subscribeToCheckIns = useChallengeStore((s) => s.subscribeToCheckIns);
  const unsubscribeAll = useChallengeStore((s) => s.unsubscribeAll);
  const setChallengeCompleted = useChallengeStore((s) => s.setChallengeCompleted);

  const challenge = challenges.find((c) => c.id === id);
  const goals = goalsMap[id] ?? [];
  const checkIns = checkInsMap[id] ?? [];

  const { logCheckIn, loading: checkInLoading } = useCheckIn(id);

  useEffect(() => {
    subscribeToCheckIns(id);
    return () => unsubscribeAll();
  }, [id, subscribeToCheckIns, unsubscribeAll]);

  const summary = useMemo(
    () => challenge ? computeProtection(challenge, goals, checkIns) : null,
    [challenge, goals, checkIns]
  );

  const goalProgressList = useMemo(
    () => goals.map((g) => computeGoalProgress(g, checkIns)),
    [goals, checkIns]
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

  if (!challenge || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.challengeName}>{challenge.name}</Text>
          <Badge
            label={canComplete ? 'Ready to complete' : `${pluralize(daysLeft, 'day')} left`}
            color={canComplete ? '#dcfce7' : '#f0f0f0'}
            textColor={canComplete ? '#16a34a' : '#555'}
          />
        </View>

        <Text style={styles.dates}>
          {formatDateShort(challenge.start_date)} — {formatDateShort(challenge.end_date)}
        </Text>

        <StakeSummaryPanel summary={summary} />

        <View style={styles.goalsSection}>
          <Text style={styles.sectionTitle}>Goals</Text>
          {goalProgressList.map((progress) => (
            <GoalRow
              key={progress.goal.id}
              progress={progress}
              onCheckIn={logCheckIn}
              loading={checkInLoading === progress.goal.id}
            />
          ))}
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
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 16 },
  back: {},
  backText: { fontSize: 16, color: '#555' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  challengeName: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', flex: 1 },
  dates: { fontSize: 13, color: '#999', marginTop: -8 },
  goalsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 14,
  },
  completeBtn: { marginTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: '#666' },
});
