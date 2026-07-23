import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/constants/theme';

const TRACK_HEIGHT = 190;
const THUMB_SIZE = 60;
const THUMB_INSET = 6;
const TRAVEL = TRACK_HEIGHT - THUMB_SIZE - THUMB_INSET * 2;
const CONFIRM_THRESHOLD = 0.6;

interface SwipeToConfirmProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}

export function SwipeToConfirm({ label, loading = false, disabled = false, onConfirm }: SwipeToConfirmProps) {
  const [confirmed, setConfirmed] = useState(false);
  const pan = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;
  const valueRef = useRef(0);
  const grantValueRef = useRef(0);
  const firedRef = useRef(false);

  const locked = disabled || confirmed || loading;

  useEffect(() => {
    const id = pan.addListener(({ value }) => {
      valueRef.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

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

  useEffect(() => {
    if (!loading && firedRef.current) {
      firedRef.current = false;
      setConfirmed(false);
      Animated.timing(pan, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [loading, pan]);

  const finalizeGesture = (dy: number) => {
    const next = clamp(grantValueRef.current + dy, -TRAVEL, 0);
    const crossed = Math.abs(next) >= TRAVEL * CONFIRM_THRESHOLD;
    if (crossed) {
      firedRef.current = true;
      setConfirmed(true);
      Animated.spring(pan, { toValue: -TRAVEL, useNativeDriver: true, bounciness: 4 }).start();
      onConfirm();
    } else {
      Animated.spring(pan, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !locked,
        onMoveShouldSetPanResponder: (_, gesture) => !locked && Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          grantValueRef.current = valueRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          const next = clamp(grantValueRef.current + gesture.dy, -TRAVEL, 0);
          pan.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => finalizeGesture(gesture.dy),
        onPanResponderTerminate: (_, gesture) => finalizeGesture(gesture.dy),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked]
  );

  const fillHeight = pan.interpolate({
    inputRange: [-TRAVEL, 0],
    outputRange: [TRACK_HEIGHT, THUMB_SIZE + THUMB_INSET * 2],
    extrapolate: 'clamp',
  });

  const labelOpacity = pan.interpolate({
    inputRange: [-TRAVEL * CONFIRM_THRESHOLD, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const hintTranslate = hint.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { height: fillHeight }]} />

      <Animated.Text style={[styles.label, { opacity: labelOpacity }]} pointerEvents="none">
        {label}
      </Animated.Text>

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.thumb, { transform: [{ translateY: pan }] }]}
      >
        {confirmed || loading ? (
          <ActivityIndicator color={colors.black} size="small" />
        ) : (
          <Animated.View style={{ transform: [{ translateY: hintTranslate }] }}>
            <Ionicons name="chevron-up" size={26} color={colors.black} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    opacity: 0.08,
  },
  label: {
    position: 'absolute',
    top: 22,
    left: 16,
    right: 16,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.white,
    marginBottom: THUMB_INSET,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
