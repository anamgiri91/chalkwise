export function getDataMode(): 'mock' | 'supabase' | 'api' {
  const mode = process.env.EXPO_PUBLIC_DATA_MODE ?? 'mock';

  if (mode !== 'mock' && mode !== 'supabase' && mode !== 'api') {
    throw new Error('Chalkwise: EXPO_PUBLIC_DATA_MODE must be mock, api or supabase.');
  }

  return mode;
}
