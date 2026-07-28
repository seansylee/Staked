import { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

const DRAG_ZONE = 90;
const CONFIRM_THRESHOLD = 0.55;
const THUMB_SIZE = 56;

export type SwipeStatus = 'idle' | 'processing' | 'success';

interface SwipeToConfirmProps {
  label: string;
  confirmTitle: string;
  confirmSubtitle?: string;
  status: SwipeStatus;
  onConfirm: () => void;
  children: ReactNode;
}

// A vertical curtain-pull: dragging the handle peels the current screen
// upward, revealing a lighter confirmation panel underneath. Crossing the
// threshold hands off to a canned animation so the user never has to drag
// their finger the full screen height to complete the gesture.
export function SwipeToConfirm({
  label,
  confirmTitle,
  confirmSubtitle,
  status,
  onConfirm,
  children,
}: SwipeToConfirmProps) {
  const { height: screenHeight } = useWindowDimensions();
  const curtain = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.75)).current;
  const grantRef = useRef(0);
  const armedRef = useRef(false);
  const prevStatusRef = useRef<SwipeStatus>(status);

  const locked = status !== 'idle';

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
    if (status !== 'idle') {
      Animated.timing(curtain, { toValue: -screenHeight, duration: 420, useNativeDriver: true }).start();
      badgeScale.setValue(0.75);
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 14 }).start();
    } else if (prevStatusRef.current !== 'idle') {
      // A processing attempt just failed — the parent flipped status back
      // to idle, so pull the curtain back down to reveal the retry state.
      armedRef.current = false;
      Animated.spring(curtain, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    }
    prevStatusRef.current = status;
  }, [status, screenHeight, curtain, badgeScale]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !locked,
        onMoveShouldSetPanResponder: (_, gesture) => !locked && Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          grantRef.current = 0;
        },
        onPanResponderMove: (_, gesture) => {
          const next = clamp(grantRef.current + gesture.dy, -DRAG_ZONE, 0);
          curtain.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => finalize(gesture.dy),
        onPanResponderTerminate: (_, gesture) => finalize(gesture.dy),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked, screenHeight]
  );

  const finalize = (dy: number) => {
    const next = clamp(grantRef.current + dy, -DRAG_ZONE, 0);
    const crossed = Math.abs(next) >= DRAG_ZONE * CONFIRM_THRESHOLD;
    if (crossed) {
      armedRef.current = true;
      Animated.timing(curtain, { toValue: -screenHeight, duration: 420, useNativeDriver: true }).start();
      onConfirm();
    } else {
      Animated.spring(curtain, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    }
  };

  const hintTranslate = hint.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={styles.stage}>
      <View style={styles.confirmPanel}>
        {status !== 'idle' && (
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
            <View style={styles.badgeIcon}>
              {status === 'success' ? (
                <Ionicons name="checkmark" size={30} color={colors.black} />
              ) : (
                <ActivityIndicator color={colors.black} size="small" />
              )}
            </View>
            <Text style={styles.badgeTitle}>
              {status === 'success' ? confirmTitle : 'Processing payment…'}
            </Text>
            {status === 'success' && confirmSubtitle && (
              <Text style={styles.badgeSubtitle}>{confirmSubtitle}</Text>
            )}
          </Animated.View>
        )}
      </View>

      <Animated.View style={[styles.curtain, { transform: [{ translateY: curtain }] }]}>
        {children}

        <View style={styles.handleZone}>
          <Text style={styles.hintLabel}>{label}</Text>
          <Animated.View {...panResponder.panHandlers} style={styles.thumb}>
            <Animated.View style={{ transform: [{ translateY: hintTranslate }] }}>
              <Ionicons name="chevron-up" size={26} color={colors.black} />
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const styles = StyleSheet.create({
  stage: { flex: 1 },
  confirmPanel: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  badge: { alignItems: 'center', gap: 10 },
  badgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badgeTitle: { fontSize: 20, fontWeight: '700', color: colors.black, textAlign: 'center' },
  badgeSubtitle: { fontSize: 14, color: colors.black, opacity: 0.6, textAlign: 'center' },
  curtain: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  handleZone: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  hintLabel: {
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});
