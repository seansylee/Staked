import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

interface FetchErrorNoticeProps {
  onRetry: () => void;
  compact?: boolean; // banner above stale data vs full empty-state
}

export function FetchErrorNotice({ onRetry, compact = false }: FetchErrorNoticeProps) {
  if (compact) {
    return (
      <TouchableOpacity style={styles.banner} onPress={onRetry} activeOpacity={0.7}>
        <Text style={styles.bannerText}>Couldn&apos;t refresh — showing last known data. Tap to retry.</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.full}>
      <Text style={styles.title}>Connection trouble</Text>
      <Text style={styles.body}>
        We couldn&apos;t reach the server. Your challenges and money are safe — this is just a
        network issue.
      </Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#A07840',
  },
  bannerText: { fontSize: 12, color: '#A07840', fontWeight: '500' },
  full: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  retryBtn: {
    marginTop: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: radius.md,
  },
  retryText: { color: colors.black, fontWeight: '700', fontSize: 14 },
});
