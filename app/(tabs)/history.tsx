import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Challenge } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatting';

export default function HistoryScreen() {
  const challenges = useChallengeStore((s) => s.challenges);
  const completed = challenges.filter((c) => c.status === 'completed');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      {completed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No completed challenges yet</Text>
          <Text style={styles.emptySubtitle}>Finish a challenge to see it here.</Text>
        </View>
      ) : (
        <FlatList<Challenge>
          data={completed}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/challenge/${item.id}/summary`)}
            >
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.date}>{formatDate(item.end_date)}</Text>
                </View>
                <View style={styles.amounts}>
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
              </Card>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySubtitle: { fontSize: 14, color: '#666' },
  list: { padding: 16 },
  card: { gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  date: { fontSize: 13, color: '#999' },
  amounts: { flexDirection: 'row', gap: 24 },
  amountLabel: { fontSize: 11, color: '#999', fontWeight: '500' },
  amount: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  green: { color: '#16a34a' },
  red: { color: '#dc2626' },
});
