import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0–1
  height?: number;
  color?: string;
  backgroundColor?: string;
  showFinishLine?: boolean;
}

export function ProgressBar({
  progress,
  height = 4,
  color = colors.white,
  backgroundColor = colors.border,
  showFinishLine = false,
}: ProgressBarProps) {
  const pct = Math.min(1, Math.max(0, progress)) * 100;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.track, { height, backgroundColor }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, height }]} />
      </View>
      {showFinishLine && <Text style={styles.flag}>🏁</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, borderRadius: 99, overflow: 'hidden' },
  fill: { borderRadius: 99 },
  flag: { fontSize: 14 },
});
