import { useState } from 'react';
import { posthog } from '@/lib/posthog';
import { useChallengeStore } from '@/store/useChallengeStore';
import { useUIStore } from '@/store/useUIStore';

export function useCheckIn(challengeId: string) {
  const [loading, setLoading] = useState<string | null>(null); // goalId being logged
  const addCheckIn = useChallengeStore((s) => s.addCheckIn);
  const showToast = useUIStore((s) => s.showToast);

  const logCheckIn = async (goalId: string) => {
    if (loading) return;
    setLoading(goalId);
    try {
      await addCheckIn(goalId, challengeId);
      posthog.capture('check_in_logged', { challenge_id: challengeId, goal_id: goalId });
    } catch {
      showToast('Failed to log check-in. Please try again.', 'error');
    } finally {
      setLoading(null);
    }
  };

  return { logCheckIn, loading };
}
