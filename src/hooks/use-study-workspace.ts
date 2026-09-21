import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getStudyDashboard } from '@/services/study';

export function useStudyWorkspace() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getStudyDashboard>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    getStudyDashboard().then((result) => { if (active) setData(result); })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : 'Could not load your notebooks.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));
  return { data, error, loading, retry: () => setAttempt((value) => value + 1) };
}
