import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { GoalProgress } from '@/types';

interface GoalRowProps {
  progress: GoalProgress;
  onCheckIn: (goalId: string) => void;
  loading: boolean;
}

export function GoalRow({ progress, onCheckIn, loading }: GoalRowProps) {
  const { goal, currentCount, targetCount, windowLabel, isCompleted } = progress;

  const dots = Array.from({ length: targetCount }, (_, i) => i < currentCount);

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{goal.name}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => {}} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.meta}>
          <View style={styles.dots}>
            {dots.map((filled, i) => (
              <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
            ))}
          </View>
          <Text style={styles.window}>{windowLabel}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btn, isCompleted && styles.btnDone]}
        onPress={() => onCheckIn(goal.id)}
        disabled={loading || isCompleted}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator
            color={isCompleted ? colors.success : colors.black}
            size="small"
          />
        ) : (
          <Text style={[styles.btnText, isCompleted && styles.btnTextDone]}>
            {isCompleted ? '✓ Done' : 'Log it'}
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
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  info: { flex: 1, gap: 7 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  editBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  editBtnText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotFilled: { backgroundColor: colors.success },
  window: { fontSize: 12, color: colors.textMuted },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.full ?? 99,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDone: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success },
  btnText: { color: colors.black, fontWeight: '600', fontSize: 13 },
  btnTextDone: { color: colors.success, fontSize: 13, fontWeight: '600' },
});
