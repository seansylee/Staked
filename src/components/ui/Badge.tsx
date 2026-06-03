import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
}

export function Badge({
  label,
  color = colors.surfaceHigh,
  textColor = colors.textSecondary,
}: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
