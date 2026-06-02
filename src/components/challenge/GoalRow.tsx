import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GoalProgress } from '@/types';

interface GoalRowProps {
  progress: GoalProgress;
  onCheckIn: (goalId: string) => void;
  loading: boolean;
}

export function GoalRow({ progress, onCheckIn, loading }: GoalRowProps) {
  const { goal, currentCount, targetCount, windowLabel, isCompleted } = progress;
  const ratio = Math.min(currentCount / targetCount, 1);

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{goal.name}</Text>
        <View style={styles.progressRow}>
          <Text style={[styles.count, isCompleted && styles.countDone]}>
            {currentCount} / {targetCount} {windowLabel}
          </Text>
          <ProgressBar
            progress={ratio}
            height={4}
            color={isCompleted ? '#16a34a' : '#1a1a1a'}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.checkInBtn, isCompleted && styles.checkInBtnDone]}
        onPress={() => onCheckIn(goal.id)}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color={isCompleted ? '#16a34a' : '#fff'} size="small" />
        ) : (
          <Text style={[styles.checkInText, isCompleted && styles.checkInTextDone]}>
            {isCompleted ? '✓' : '+1'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  info: { flex: 1, gap: 8 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  progressRow: { gap: 4 },
  count: { fontSize: 13, color: '#666' },
  countDone: { color: '#16a34a' },
  checkInBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkInBtnDone: { backgroundColor: '#dcfce7' },
  checkInText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  checkInTextDone: { color: '#16a34a' },
});
