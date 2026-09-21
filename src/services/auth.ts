import { getDataMode } from '@/lib/dataMode';
import { apiRequest } from '@/lib/api';
import { apiSignIn, apiSignOut, apiSignUp, getApiSession, onApiAuthChange } from '@/lib/cognito';
export {
  apiConfirmSignUp as confirmEmail,
  apiResendCode as resendConfirmationCode,
  apiForgotPassword as requestPasswordReset,
  apiResetPassword as resetPassword,
} from '@/lib/cognito';

export const supportsEmailCode = () => getDataMode() === 'api';
import type { Profile, ProfileInput } from '@/types';

const profileColumns = 'id, name, year, major';
const demoIdKey = 'chalkwise.demo-profile-id';
let demoProfile: Profile = {
  id: 'demo-student',
  name: 'Alex Morgan',
  year: 'Junior',
  major: 'Computer Science',
};

function localStore(): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
} | null {
  const store = (
    globalThis as {
      localStorage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
      };
    }
  ).localStorage;
  return store ?? null;
}

/**
 * Whose profile to read and write. A signed-in user owns their auth id. The
 * signed-out demo keeps one stable local id instead, so onboarding can save and
 * the same profile is found again on the next launch.
 */
async function profileOwnerId(): Promise<string> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  const signedIn = data.session?.user.id;
  if (signedIn) return signedIn;

  const store = localStore();
  const saved = store?.getItem(demoIdKey);
  if (saved) return saved;

  const { randomUUID } = await import('expo-crypto');
  const generated = randomUUID();
  store?.setItem(demoIdKey, generated);
  return generated;
}

const profileListeners = new Set<() => void>();

/** Lets the route gate re-check the profile the moment onboarding saves. */
export function onProfileChange(listener: () => void): () => void {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

function requireSupabase(action: string) {
  if (getDataMode() !== 'supabase') {
    throw new Error(`${action} requires EXPO_PUBLIC_DATA_MODE=supabase.`);
  }
}

/** Current user ID, or null when signed out. Never exposes auth fields. */
export async function getCurrentUserId(): Promise<string | null> {
  if (getDataMode() === 'api') return (await getApiSession())?.userId ?? null;
  if (getDataMode() === 'mock') return demoProfile.id;
  if (getDataMode() !== 'supabase') return null;
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Fires on sign in, sign out and token refresh so the app can re-gate. */
export async function onAuthChange(listener: (userId: string | null) => void): Promise<() => void> {
  if (getDataMode() === 'api') return onApiAuthChange(listener);
  if (getDataMode() === 'mock') {
    listener(demoProfile.id);
    return () => {};
  }
  if (getDataMode() !== 'supabase') {
    listener(null);
    return () => {};
  }
  const { supabase } = await import('@/lib/supabase');
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session?.user.id ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  if (getDataMode() === 'api') return apiSignUp(email, password);
  requireSupabase('Sign up');
  const address = email.trim();
  if (!address) throw new Error('Email is required.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.auth.signUp({ email: address, password });
  if (error) throw new Error(error.message);
  return { requiresEmailConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (getDataMode() === 'api') return apiSignIn(email, password);
  requireSupabase('Sign in');
  const address = email.trim();
  if (!address || !password) throw new Error('Email and password are required.');

  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.auth.signInWithPassword({ email: address, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  if (getDataMode() === 'api') return apiSignOut();
  if (getDataMode() === 'mock') return;
  requireSupabase('Sign out');
  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/** Null means onboarding has not been completed yet. */
export async function getMyProfile(): Promise<Profile | null> {
  if (getDataMode() === 'api') return apiRequest('/profile');
  if (getDataMode() === 'mock') return { ...demoProfile };
  if (getDataMode() !== 'supabase') return null;
  const { supabase } = await import('@/lib/supabase');
  const id = await profileOwnerId();

  const { data, error } = await supabase
    .from('profiles')
    .select(profileColumns)
    .eq('id', id)
    .returns<Profile[]>()
    .maybeSingle();

  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data;
}

/** Completes onboarding, and later edits. Writes only the signed-in user's row. */
export async function saveMyProfile(input: ProfileInput): Promise<Profile> {
  if (getDataMode() === 'api') {
    const profile = await apiRequest<Profile>('/profile', { method: 'PUT', body: input });
    profileListeners.forEach((listener) => listener());
    return profile;
  }
  if (getDataMode() === 'mock') {
    if (!input.name.trim() || !input.major.trim()) throw new Error('Name and major are required.');
    demoProfile = { ...input, id: demoProfile.id };
    profileListeners.forEach((listener) => listener());
    return { ...demoProfile };
  }
  requireSupabase('Saving your profile');
  const name = input.name.trim();
  const major = input.major.trim();
  if (!name) throw new Error('Your name is required.');
  if (!major) throw new Error('Your major or program is required.');

  const { supabase } = await import('@/lib/supabase');
  const id = await profileOwnerId();

  // Not upsert: PostgREST turns it into ON CONFLICT DO UPDATE over every column
  // in the payload, including id, and id is deliberately not UPDATE-grantable.
  // Update first, then insert when no row existed.
  const updated = await supabase
    .from('profiles')
    .update({ name, year: input.year, major })
    .eq('id', id)
    .select(profileColumns)
    .returns<Profile[]>()
    .maybeSingle();

  if (updated.error) throw new Error(`Could not save your profile: ${updated.error.message}`);
  if (updated.data) {
    profileListeners.forEach((listener) => listener());
    return updated.data;
  }

  const inserted = await supabase
    .from('profiles')
    .insert({ id, name, year: input.year, major })
    .select(profileColumns)
    .returns<Profile[]>()
    .single();

  if (inserted.error) {
    // A concurrent first save won the insert; read back what it stored.
    if (inserted.error.code === '23505') {
      const existing = await getMyProfile();
      if (existing) {
        profileListeners.forEach((listener) => listener());
        return existing;
      }
    }
    throw new Error(`Could not save your profile: ${inserted.error.message}`);
  }
  if (!inserted.data) throw new Error('No saved profile was returned.');
  profileListeners.forEach((listener) => listener());
  return inserted.data;
}
