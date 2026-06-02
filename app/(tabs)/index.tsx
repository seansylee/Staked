import { router } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChallengeCard } from '@/components/challenge/ChallengeCard';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Challenge } from '@/types';

export default function DashboardScreen() {
  const { challenges, isLoading, fetchChallenges } = useChallengeStore();

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const active = challenges.filter((c) => c.status === 'active');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/challenge/new/details')}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a1a1a" />
        </View>
      ) : active.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No active challenges</Text>
          <Text style={styles.emptySubtitle}>
            Create your first challenge and put{'\n'}real money behind your goals.
          </Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/challenge/new/details')}
            activeOpacity={0.8}
          >
            <Text style={styles.createBtnText}>Create Challenge</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<Challenge>
          data={active}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ChallengeCard challenge={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f8f8',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  createBtn: {
    marginTop: 8,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  list: { padding: 16 },
});
