import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { GoalDraft, Window } from '@/types';

const WINDOWS: { label: string; value: Window }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function GoalsScreen() {
  const { draft, updateDraftGoals } = useChallengeStore();
  const [goals, setGoals] = useState<GoalDraft[]>(draft?.goals ?? []);
  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [goalWindow, setGoalWindow] = useState<Window>('daily');

  const addGoal = () => {
    const trimmed = name.trim();
    const n = parseInt(count, 10);
    if (!trimmed) { Alert.alert('Enter a goal name'); return; }
    if (!n || n < 1) { Alert.alert('Count must be at least 1'); return; }
    setGoals((g) => [...g, { name: trimmed, target_count: n, goal_window: goalWindow }]);
    setName('');
    setCount('1');
    setGoalWindow('daily');
  };

  const onNext = () => {
    if (goals.length === 0) { Alert.alert('Add at least one goal'); return; }
    updateDraftGoals(goals);
    router.push('/challenge/new/payment');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.stepText}>2 / 3</Text>
        <Text style={styles.title}>Goals</Text>
        <Text style={styles.subtitle}>What will you commit to?</Text>

        {goals.map((g, i) => (
          <View key={i} style={styles.goalItem}>
            <View style={styles.goalInfo}>
              <Text style={styles.goalName}>{g.name}</Text>
              <Text style={styles.goalDetail}>{g.target_count}× / {g.goal_window}</Text>
            </View>
            <TouchableOpacity onPress={() => setGoals((prev) => prev.filter((_, j) => j !== i))}>
              <Text style={styles.remove}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.addForm}>
          <Text style={styles.formTitle}>Add Goal</Text>
          <Input placeholder="Goal name" value={name} onChangeText={setName} />

          <View style={styles.countRow}>
            <View style={styles.countWrap}>
              <Input
                label="Times"
                placeholder="3"
                keyboardType="numeric"
                value={count}
                onChangeText={setCount}
              />
            </View>
            <View style={styles.windowWrap}>
              <Text style={styles.fieldLabel}>Per</Text>
              <View style={styles.windowOptions}>
                {WINDOWS.map((w) => (
                  <TouchableOpacity
                    key={w.value}
                    style={[styles.pill, goalWindow === w.value && styles.pillActive]}
                    onPress={() => setGoalWindow(w.value)}
                  >
                    <Text style={[styles.pillText, goalWindow === w.value && styles.pillActiveText]}>
                      {w.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Button title="Add Goal" variant="secondary" onPress={addGoal} />
        </View>

        <Button
          title={`Next: Payment →  (${goals.length} goal${goals.length !== 1 ? 's' : ''})`}
          onPress={onNext}
          disabled={goals.length === 0}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48, gap: 14 },
  back: { paddingVertical: 12 },
  backText: { fontSize: 22, color: colors.textSecondary },
  stepText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: -8 },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalInfo: { flex: 1 },
  goalName: { fontSize: 15, fontWeight: '600', color: colors.text },
  goalDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  remove: { fontSize: 16, color: colors.textMuted, paddingLeft: 12 },
  addForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  formTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  countRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' },
  countWrap: { width: 80 },
  windowWrap: { flex: 1, gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  windowOptions: { flexDirection: 'row', gap: 6 },
  pill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
  },
  pillActive: { backgroundColor: colors.white, borderColor: colors.white },
  pillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  pillActiveText: { color: colors.black },
});
