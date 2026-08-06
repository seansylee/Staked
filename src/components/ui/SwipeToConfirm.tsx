import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

const DRAG_ZONE = 70;
const CONFIRM_THRESHOLD = 0.6;
const BAR_CONTENT_HEIGHT = 96;

export type SwipeStatus = 'idle' | 'processing';

interface SwipeToConfirmProps {
  label: string;
  status: SwipeStatus;
  disabled?: boolean;
  onConfirm: () => void;
  children: ReactNode;
}

// A slim, always-visible bar pinned to the bottom — mirrors a standard
// brokerage-app buy flow (chevron + "Swipe Up To Submit", solid color,
// no separate handle). The whole bar is the drag surface; crossing the
// threshold hands off to the parent, which shows a processing spinner in
// place and then navigates to a dedicated confirmation screen on success.
export function SwipeToConfirm({ label, status, disabled = false, onConfirm, children }: SwipeToConfirmProps) {
  const insets = useSafeAreaInsets();
  const lift = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;

  const locked = disabled || status !== 'idle';

  useEffect(() => {
    if (locked) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hint, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(hint, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hint, locked]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !locked,
        onMoveShouldSetPanResponder: (_, gesture) => !locked && Math.abs(gesture.dy) > 2,
        onPanResponderMove: (_, gesture) => {
          const extra = clamp(-gesture.dy, 0, DRAG_ZONE);
          lift.setValue(-extra * 0.3);
        },
        onPanResponderRelease: (_, gesture) => finalize(gesture.dy),
        onPanResponderTerminate: (_, gesture) => finalize(gesture.dy),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked]
  );

  const finalize = (dy: number) => {
    const extra = clamp(-dy, 0, DRAG_ZONE);
    const crossed = extra >= DRAG_ZONE * CONFIRM_THRESHOLD;
    Animated.spring(lift, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    if (crossed) onConfirm();
  };

  const hintTranslate = hint.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const idleDisabled = disabled && status === 'idle';
  const hintColor = idleDisabled ? colors.textSecondary : colors.white;

  return (
    <View style={styles.stage}>
      <View style={styles.content}>{children}</View>

      <Animated.View
        {...(locked ? {} : panResponder.panHandlers)}
        style={[
          styles.bar,
          idleDisabled && styles.barDisabled,
          { paddingBottom: insets.bottom + 14, transform: [{ translateY: lift }] },
        ]}
      >
        {status === 'processing' ? (
          <View style={styles.hintStack}>
            <ActivityIndicator color={colors.white} size="small" />
            <Text style={styles.label}>Processing…</Text>
          </View>
        ) : (
          <View style={styles.hintStack}>
            <Animated.View style={{ transform: [{ translateY: hintTranslate }] }}>
              <Ionicons name="chevron-up" size={18} color={hintColor} />
            </Animated.View>
            <Text style={[styles.label, { color: hintColor }]}>{label}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  content: { flex: 1, backgroundColor: colors.bg },
  bar: {
    minHeight: BAR_CONTENT_HEIGHT,
    backgroundColor: colors.success,
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barDisabled: { backgroundColor: colors.surfaceHigh },
  hintStack: { alignItems: 'center', gap: 6 },
  label: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2, color: colors.white },
});
