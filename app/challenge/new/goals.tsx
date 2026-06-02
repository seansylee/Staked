import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalCount, setNewGoalCount] = useState('1');
  const [newGoalWindow, setNewGoalWindow] = useState<Window>('daily');

  const addGoal = () => {
    const name = newGoalName.trim();
    const count = parseInt(newGoalCount, 10);
    if (!name) { Alert.alert('Enter a goal name'); return; }
    if (!count || count < 1) { Alert.alert('Count must be at least 1'); return; }
    const newGoal: GoalDraft = { name, target_count: count, window: newGoalWindow };
    setGoals((g) => [...g, newGoal]);
    setNewGoalName('');
    setNewGoalCount('1');
    setNewGoalWindow('daily');
  };

  const removeGoal = (index: number) => {
    setGoals((g) => g.filter((_, i) => i !== index));
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 2 of 3</Text>
        </View>

        <Text style={styles.title}>Goals</Text>
        <Text style={styles.subtitle}>
          What will you commit to? Add one or more goals.
        </Text>

        {/* Existing goals */}
        {goals.map((g, i) => (
          <View key={i} style={styles.goalChip}>
            <View style={styles.goalInfo}>
              <Text style={styles.goalName}>{g.name}</Text>
              <Text style={styles.goalDetail}>
                {g.target_count}x / {g.window}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeGoal(i)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add goal form */}
        <View style={styles.addForm}>
          <Text style={styles.addFormTitle}>Add Goal</Text>
          <Input
            label="Goal name"
            placeholder="e.g. Gym"
            value={newGoalName}
            onChangeText={setNewGoalName}
          />

          <View style={styles.countRow}>
            <View style={styles.countInput}>
              <Input
                label="Times"
                placeholder="3"
                keyboardType="numeric"
                value={newGoalCount}
                onChangeText={setNewGoalCount}
              />
            </View>
            <View style={styles.windowPicker}>
              <Text style={styles.fieldLabel}>Per</Text>
              <View style={styles.windowOptions}>
                {WINDOWS.map((w) => (
                  <TouchableOpacity
                    key={w.value}
                    style={[styles.windowChip, newGoalWindow === w.value && styles.windowChipActive]}
                    onPress={() => setNewGoalWindow(w.value)}
                  >
                    <Text
                      style={[styles.windowChipText, newGoalWindow === w.value && styles.windowChipActiveText]}
                    >
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
          title={`Next: Payment (${goals.length} goal${goals.length !== 1 ? 's' : ''})`}
          onPress={onNext}
          disabled={goals.length === 0}
          style={styles.nextBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48, gap: 16 },
  back: {},
  backText: { fontSize: 16, color: '#555' },
  stepIndicator: {},
  stepText: { fontSize: 13, color: '#999', fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 15, color: '#666', marginTop: -8 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 14,
  },
  goalInfo: { flex: 1 },
  goalName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  goalDetail: { fontSize: 13, color: '#666', marginTop: 2 },
  removeBtn: { fontSize: 16, color: '#999', paddingLeft: 12 },
  addForm: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  addFormTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  countRow: { flexDirection: 'row', gap: 16 },
  countInput: { width: 80 },
  windowPicker: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  windowOptions: { flexDirection: 'row', gap: 6 },
  windowChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  windowChipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  windowChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  windowChipActiveText: { color: '#fff' },
  nextBtn: { marginTop: 8 },
});
