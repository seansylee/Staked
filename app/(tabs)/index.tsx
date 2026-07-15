import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChallengeCard } from '@/components/challenge/ChallengeCard';
import { FetchErrorNotice } from '@/components/ui/FetchErrorNotice';
import { colors } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Challenge } from '@/types';
import { isChallengeComplete } from '@/utils/protection';

export default function DashboardScreen() {
  const { challenges, isLoading, fetchError, fetchChallenges } = useChallengeStore();
  const recoverPendingConfirmation = useChallengeStore((s) => s.recoverPendingConfirmation);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Heal any paid-but-unconfirmed challenge (app killed or offline right
  // after the Stripe charge). Waits for the persisted store to rehydrate.
  useEffect(() => {
    if (useChallengeStore.persist.hasHydrated()) {
      recoverPendingConfirmation();
      return;
    }
    return useChallengeStore.persist.onFinishHydration(() => recoverPendingConfirmation());
  }, [recoverPendingConfirmation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChallenges();
    setRefreshing(false);
  }, [fetchChallenges]);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
  );

  const active = challenges
    .filter((c) => c.status === 'active')
    .sort((a, b) => Number(isChallengeComplete(b)) - Number(isChallengeComplete(a)));

  const firstLoad = isLoading && !refreshing && challenges.length === 0 && !fetchError;
  // A fetch failure with nothing cached must never render as "no active
  // challenges" — a user with money staked would think it vanished.
  const failedWithNothing = !!fetchError && challenges.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/challenge/new/details')}
          activeOpacity={0.7}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {fetchError && challenges.length > 0 && <FetchErrorNotice compact onRetry={fetchChallenges} />}

      {firstLoad ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : failedWithNothing ? (
        <FetchErrorNotice onRetry={fetchChallenges} />
      ) : active.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScroll} refreshControl={refreshControl}>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No active challenges</Text>
            <Text style={styles.emptySubtitle}>
              Stake money on your goals.{'\n'}Follow through to get it back.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/challenge/new/details')}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyBtnText}>Create Challenge</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList<Challenge>
          data={active}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ChallengeCard challenge={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 26, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
  newBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  newBtnText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyScroll: { flexGrow: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyBtnText: { color: colors.black, fontWeight: '700', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
});
