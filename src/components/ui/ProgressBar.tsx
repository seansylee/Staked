import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0–1
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function ProgressBar({
  progress,
  height = 4,
  color = colors.white,
  backgroundColor = colors.border,
}: ProgressBarProps) {
  const pct = Math.min(1, Math.max(0, progress)) * 100;

  return (
    <View style={[styles.track, { height, backgroundColor }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 99, overflow: 'hidden' },
  fill: { borderRadius: 99 },
});
