import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

interface GoalRowProps {
  currentCount: number;
  targetCount: number;
  windowLabel: string;
  isCompleted: boolean;
  onCheckIn: () => void;
  loading: boolean;
}

export function GoalRow({ currentCount, targetCount, windowLabel, isCompleted, onCheckIn, loading }: GoalRowProps) {
  const dots = Array.from({ length: targetCount }, (_, i) => i < currentCount);

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <View style={styles.dots}>
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </View>
        <Text style={styles.window}>{windowLabel}</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, isCompleted && styles.btnDone]}
        onPress={onCheckIn}
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
    paddingVertical: 22,
    gap: 12,
  },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotFilled: { backgroundColor: colors.success },
  window: { fontSize: 13, color: colors.textMuted },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.full ?? 99,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDone: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success },
  btnText: { color: colors.black, fontWeight: '600', fontSize: 14 },
  btnTextDone: { color: colors.success, fontSize: 14, fontWeight: '600' },
});
