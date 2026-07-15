import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Challenge } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatting';

export default function HistoryScreen() {
  const challenges = useChallengeStore((s) => s.challenges);
  const fetchChallenges = useChallengeStore((s) => s.fetchChallenges);
  const [refreshing, setRefreshing] = useState(false);
  const settled = challenges.filter((c) => c.status === 'completed' || c.status === 'quit');

  // The store may be empty if the app cold-started on this tab (deep link).
  useEffect(() => {
    if (challenges.length === 0) fetchChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchChallenges]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChallenges();
    setRefreshing(false);
  }, [fetchChallenges]);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      {settled.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScroll} refreshControl={refreshControl}>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No past challenges</Text>
            <Text style={styles.emptySubtitle}>Finish a challenge to see it here.</Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList<Challenge>
          data={settled}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                router.push(
                  item.status === 'quit'
                    ? `/challenge/${item.id}/quit-summary`
                    : `/challenge/${item.id}/summary`
                )
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {item.status === 'quit' && <Text style={styles.quitTag}>QUIT EARLY</Text>}
                </View>
                <Text style={styles.cardDate}>{formatDate(item.end_date)}</Text>
              </View>
              <View style={styles.cardAmounts}>
                <View>
                  <Text style={styles.amountLabel}>Staked</Text>
                  <Text style={styles.amount}>{formatCurrency(item.stake_amount)}</Text>
                </View>
                <View>
                  <Text style={styles.amountLabel}>Returned</Text>
                  <Text style={[styles.amount, styles.green]}>
                    {formatCurrency(item.protected_amount_cents ?? 0)}
                  </Text>
                </View>
                {(item.forfeited_amount_cents ?? 0) > 0 && (
                  <View>
                    <Text style={styles.amountLabel}>Forfeited</Text>
                    <Text style={[styles.amount, styles.red]}>
                      {formatCurrency(item.forfeited_amount_cents ?? 0)}
                    </Text>
                  </View>
                )}
              </View>
              {item.refund_status === 'failed' && (item.protected_amount_cents ?? 0) > 0 && (
                <Text style={styles.refundFailed}>Refund failed — contact support</Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          refreshControl={refreshControl}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
  emptyScroll: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.text },
  quitTag: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardDate: { fontSize: 12, color: colors.textSecondary },
  refundFailed: { fontSize: 12, fontWeight: '600', color: colors.danger },
  cardAmounts: { flexDirection: 'row', gap: 28 },
  amountLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '500',
    marginBottom: 2,
  },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
  green: { color: colors.success },
  red: { color: colors.danger },
});
