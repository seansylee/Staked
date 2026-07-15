import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DEMO_MODE } from './demo';
import { supabase } from './supabase';
import { Challenge } from '@/types';
import { challengeEndExclusive, localTimeLabel, nextWindowBoundary } from '@/utils/dates';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Never throws — callers fire-and-forget this during sign-in/sign-up, and a
// notification failure must not break auth. getExpoPushTokenAsync in
// particular throws in dev builds when no EAS projectId is configured yet.
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (DEMO_MODE || !Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId: string | undefined =
      Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    const token = (
      await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    ).data;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
    }

    return token;
  } catch (err) {
    console.warn('Push notification registration failed', err);
    return null;
  }
}

export function clearAllReminders(): void {
  if (DEMO_MODE) return;
  Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

const CHECK_IN_LEAD_MS = 2 * 3_600_000;
const CLAIM_NUDGE_DELAY_MS = 3 * 86_400_000;

// Reconciles all local reminders against store state. Identifiers are stable
// per challenge, so re-running replaces rather than duplicates. Never throws —
// reminders must not break the data flow that triggers them.
export async function syncChallengeReminders(challenges: Challenge[]): Promise<void> {
  if (DEMO_MODE) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const now = Date.now();

    for (const c of challenges) {
      const endsAt = challengeEndExclusive(c.end_date);
      const claims = [
        {
          identifier: `claim-${c.id}`,
          fireAt: endsAt,
          title: 'Challenge complete 🎉',
          body: `"${c.name}" has ended. Open Staked to claim your refund.`,
        },
        {
          identifier: `claim-nudge-${c.id}`,
          fireAt: endsAt + CLAIM_NUDGE_DELAY_MS,
          title: 'Your refund is waiting',
          body: `You haven't claimed your refund for "${c.name}" yet. It won't wait forever.`,
        },
      ];
      for (const claim of claims) {
        if (c.status !== 'active') {
          await Notifications.cancelScheduledNotificationAsync(claim.identifier);
        } else if (claim.fireAt > now) {
          await Notifications.scheduleNotificationAsync({
            identifier: claim.identifier,
            content: { title: claim.title, body: claim.body },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: claim.fireAt,
              channelId: 'default',
            },
          });
        }
      }
    }

    const dailies = challenges.filter(
      (c) => c.status === 'active' && c.goal_window === 'daily' && challengeEndExclusive(c.end_date) > now
    );
    if (dailies.length === 0) {
      await Notifications.cancelScheduledNotificationAsync('daily-checkin');
      return;
    }

    const boundary = nextWindowBoundary('daily');
    const remindAt = new Date(boundary.getTime() - CHECK_IN_LEAD_MS);
    const closesAt = localTimeLabel(boundary);
    const body =
      dailies.length === 1
        ? `"${dailies[0].name}" closes at ${closesAt}. Log it to protect your stake.`
        : `${dailies.length} challenges close at ${closesAt}. Check in to protect your stakes.`;

    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-checkin',
      content: { title: 'Staked', body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: remindAt.getHours(),
        minute: remindAt.getMinutes(),
        channelId: 'default',
      },
    });
  } catch {
    // Notification scheduling is best-effort.
  }
}
