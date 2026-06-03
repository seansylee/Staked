import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/constants/theme';
import { GoalProgress } from '@/types';

interface GoalRowProps {
  progress: GoalProgress;
  onCheckIn: (goalId: string) => void;
  loading: boolean;
}

export function GoalRow({ progress, onCheckIn, loading }: GoalRowProps) {
  const { goal, currentCount, targetCount, windowLabel, isCompleted } = progress;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{goal.name}</Text>
        <Text style={styles.progress}>
          <Text style={[styles.count, isCompleted && styles.countDone]}>
            {currentCount}/{targetCount}
          </Text>
          {'  '}
          <Text style={styles.window}>{windowLabel}</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, isCompleted && styles.btnDone]}
        onPress={() => onCheckIn(goal.id)}
        disabled={loading}
        activeOpacity={0.6}
      >
        {loading ? (
          <ActivityIndicator
            color={isCompleted ? colors.success : colors.black}
            size="small"
          />
        ) : (
          <Text style={[styles.btnText, isCompleted && styles.btnTextDone]}>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 16,
  },
  info: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  progress: {},
  count: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  countDone: { color: colors.success },
  window: { fontSize: 13, color: colors.textMuted },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDone: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success },
  btnText: { color: colors.black, fontWeight: '700', fontSize: 14 },
  btnTextDone: { color: colors.success, fontSize: 16 },
});
