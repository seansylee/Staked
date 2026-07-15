import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteAccount } from '@/api/account';
import { ApiError } from '@/api/payments';
import { DEMO_MODE } from '@/lib/demo';
import { colors, radius } from '@/constants/theme';
import { SUPPORT_EMAIL } from '@/constants/support';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore } from '@/store/useChallengeStore';

export default function SettingsScreen() {
  const { profile, signOut } = useAuthStore();
  const challenges = useChallengeStore((s) => s.challenges);
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const handleSupport = () => {
    const subject = encodeURIComponent('Staked support');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {
      Alert.alert('Contact Support', `Email us at ${SUPPORT_EMAIL}`);
    });
  };

  const runDeletion = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
      router.replace('/(auth)/welcome');
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not delete your account. Please try again or contact support.';
      Alert.alert('Deletion failed', message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    if (DEMO_MODE) {
      Alert.alert('Demo mode', 'Account deletion is disabled in demo mode.');
      return;
    }
    const hasActive = challenges.some((c) => c.status === 'active');
    if (hasActive) {
      Alert.alert(
        'Active challenge',
        'You have money staked on an active challenge. Complete or quit it first — then you can delete your account.'
      );
      return;
    }
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, challenges, and history. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you absolutely sure?', 'There is no way back after this.', [
              { text: 'Keep My Account', style: 'cancel' },
              { text: 'Yes, Delete', style: 'destructive', onPress: runDeletion },
            ]),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{profile?.email ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Help & Legal</Text>
          <View style={styles.group}>
            <TouchableOpacity style={styles.groupRow} onPress={handleSupport} activeOpacity={0.7}>
              <Text style={styles.rowLabel}>Contact Support</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.groupRow}
              onPress={() => router.push('/legal/terms')}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>Terms of Service</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.groupRow}
              onPress={() => router.push('/legal/privacy')}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.7}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAccount} disabled={deleting} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete Account'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }] },
  content: { paddingHorizontal: 20, gap: 28 },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 16 },
  chevron: { fontSize: 18, color: colors.textMuted },
  rowLabel: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 14, color: colors.textSecondary },
  footer: { gap: 4 },
  signOutBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerBg,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: colors.danger },
  deleteBtn: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'underline' },
});
