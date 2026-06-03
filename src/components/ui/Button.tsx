import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { colors, radius } from '@/constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.black : colors.text}
          size="small"
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  primary: { backgroundColor: colors.white },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.35 },

  text: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  primaryText: { color: colors.black },
  secondaryText: { color: colors.text },
  dangerText: { color: colors.white },
  ghostText: { color: colors.text },
});
