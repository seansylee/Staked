import { useState } from 'react';
import { posthog } from '@/lib/posthog';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useUIStore } from '@/store/useUIStore';

export function useCheckIn(challengeId: string) {
  const [loading, setLoading] = useState(false);
  const addCheckIn = useChallengeStore((s) => s.addCheckIn);
  const showToast = useUIStore((s) => s.showToast);

  const logCheckIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await addCheckIn(challengeId);
      posthog.capture('check_in_logged', { challenge_id: challengeId });
    } catch {
      showToast('Failed to log check-in. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return { logCheckIn, loading };
}
