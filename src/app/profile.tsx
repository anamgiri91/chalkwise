import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { EmptyState, StatusBadge } from '@/components/ui/Editorial';
import { getInitials } from '@/features/profile/initials';
import { getMyProfile, saveMyProfile, signOut } from '@/services/auth';
import { getWorkspaceCapabilities } from '@/services/study';
import { useTheme } from '@/hooks/use-theme';
import { Brand } from '@/constants/theme';
import { years, type Profile, type Year } from '@/types';

export default function ProfileScreen() {
  const theme = useTheme();
  const capabilities = getWorkspaceCapabilities();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState<Year>('Freshman');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError('');
      setLoading(true);
      getMyProfile()
        .then((value) => {
          if (active) {
            setProfile(value);
            setName(value?.name ?? '');
            setMajor(value?.major ?? '');
            setYear(value?.year ?? 'Freshman');
          }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not load your profile.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      setProfile(await saveMyProfile({ name, major, year }));
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    setError('');
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }
  const field = {
    backgroundColor: theme.background,
    color: theme.text,
    padding: 14,
    borderRadius: 10,
    minHeight: 50,
    fontSize: 16,
  };
  return (
    <Screen showBottomNav avoidKeyboard>
      <StatusBadge label="YOUR ACCOUNT" />
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
        <View
          style={{
            width: 68,
            height: 68,
            backgroundColor: Brand.accent,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThemedText style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>
            {getInitials(profile?.name ?? 'Student')}
          </ThemedText>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText type="title" style={{ fontSize: 30, lineHeight: 38 }}>
            {profile?.name ?? 'Your profile'}
          </ThemedText>
          <ThemedText themeColor="textSecondary">A workspace that feels like yours.</ThemedText>
        </View>
      </View>
      {error ? (
        <EmptyState
          title="Something needs another try"
          description={error}
          action="Reload profile"
          onPress={() => setAttempt((x) => x + 1)}
        />
      ) : null}
      {loading ? (
        <EmptyState
          loading
          title="Loading your profile"
          description="Getting your academic details."
        />
      ) : (
        <AppCard>
          <ThemedText type="subtitle" style={{ fontSize: 22, lineHeight: 30 }}>
            Academic profile
          </ThemedText>
          {editing ? (
            <>
              <ThemedText type="smallBold">Name</ThemedText>
              <TextInput
                style={field}
                value={name}
                onChangeText={setName}
                editable={!busy}
                autoComplete="name"
                accessibilityLabel="Your name"
                maxLength={100}
              />
              <ThemedText type="smallBold">Year</ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {years.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={value}
                    accessibilityState={{ checked: year === value, disabled: busy }}
                    disabled={busy}
                    onPress={() => setYear(value)}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      minHeight: 48,
                      justifyContent: 'center',
                      backgroundColor: year === value ? theme.backgroundSelected : theme.background,
                    }}
                  >
                    <ThemedText type="small">{value}</ThemedText>
                  </Pressable>
                ))}
              </View>
              <ThemedText type="smallBold">Major or program</ThemedText>
              <TextInput
                style={field}
                value={major}
                onChangeText={setMajor}
                editable={!busy}
                accessibilityLabel="Major or program"
                maxLength={160}
              />
              <AppButton
                title={busy ? 'Saving…' : 'Save profile'}
                disabled={busy || !name.trim() || !major.trim()}
                onPress={save}
              />
              <AppButton
                secondary
                title="Cancel"
                disabled={busy}
                onPress={() => setEditing(false)}
              />
            </>
          ) : (
            <>
              <ThemedText>
                {profile?.year} · {profile?.major}
              </ThemedText>
              <AppButton
                secondary
                title="Edit profile"
                onPress={() => {
                  setName(profile?.name ?? '');
                  setMajor(profile?.major ?? '');
                  setYear(profile?.year ?? 'Freshman');
                  setEditing(true);
                  setSaved(false);
                }}
              />
            </>
          )}
          {saved ? (
            <ThemedText accessibilityLiveRegion="polite" type="small">
              Profile saved{capabilities.mode === 'mock' ? ' for this demo session' : ''}.
            </ThemedText>
          ) : null}
        </AppCard>
      )}
      <AppButton secondary title="Manage my courses" onPress={() => router.push('/courses')} />
      <AppCard>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <AppIcon name="lock" />
          <ThemedText style={{ fontSize: 20, fontWeight: '600' }}>
            Your material, your choice
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">
          {capabilities.mode === 'api'
            ? 'Notebooks start private. Share individual notebooks with accepted friends in the same course, and turn sharing off whenever you want.'
            : 'Your workspace uses ' +
              (capabilities.mode === 'mock'
                ? 'sample data. Nothing in this demo is uploaded.'
                : 'the existing legacy sharing model.')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Appearance follows your device's light or dark setting. Capture only material you have
          permission to save and share.
        </ThemedText>
      </AppCard>
      {capabilities.mode !== 'mock' ? (
        <AppButton
          secondary
          title={busy ? 'Please wait…' : 'Sign out'}
          disabled={busy}
          onPress={leave}
        />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Demo workspace · No real account is signed in.
        </ThemedText>
      )}
    </Screen>
  );
}
