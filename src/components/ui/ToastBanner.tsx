import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';
import { useUIStore } from '@/store/useUIStore';

export function ToastBanner() {
  const toast = useUIStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const lastMessage = useRef('');
  const lastType = useRef<'success' | 'error'>('success');

  if (toast?.message) {
    lastMessage.current = toast.message;
    lastType.current = toast.type;
  }

  useEffect(() => {
    if (toast) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [toast, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        lastType.current === 'error' && styles.bannerError,
        { top: insets.top + 12, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.message}>{lastMessage.current}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  bannerError: { borderColor: colors.danger },
  message: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
});
