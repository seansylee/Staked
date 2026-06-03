import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius } from '@/constants/theme';

export function Card({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
