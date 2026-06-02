import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0–1
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function ProgressBar({
  progress,
  height = 6,
  color = '#1a1a1a',
  backgroundColor = '#f0f0f0',
}: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <View style={[styles.track, { height, backgroundColor }]}>
      <View
        style={[styles.fill, { width: `${clampedProgress * 100}%`, backgroundColor: color, height }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 99, overflow: 'hidden' },
  fill: { borderRadius: 99 },
});
