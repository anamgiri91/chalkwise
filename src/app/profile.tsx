import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { Row, RowGroup, Section, Toolbar } from '@/components/ui/DataRow';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { SkeletonPage } from '@/components/ui/Skeleton';
import { Screen } from '@/components/ui/Screen';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMyProfile, saveMyProfile, signOut } from '@/services/auth';
import { getWorkspaceCapabilities } from '@/services/study';
import {
  disableReviewReminders,
  getReminderStatus,
  turnOnReviewReminders,
  type ReminderStatus,
} from '@/services/reminders';
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
  const [reminders, setReminders] = useState<ReminderStatus>('unsupported');
  const [reminderBusy, setReminderBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getReminderStatus()
        .then((status) => {
          if (active) setReminders(status);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );
  async function toggleReminders() {
    setReminderBusy(true);
    try {
      setReminders(
        reminders === 'enabled' ? await disableReviewReminders() : await turnOnReviewReminders(),
      );
    } catch {
      setError('Could not change reminders. Try again.');
    } finally {
      setReminderBusy(false);
    }
  }
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
  const first = loading && !profile;
  const incomplete = !name.trim() || !major.trim();
  return (
    <Screen showBottomNav avoidKeyboard>
      <Toolbar
        title="Profile"
        actions={
          first ? undefined : editing ? (
            <>
              <WorkspaceButton
                label="Cancel"
                accessibilityLabel="Cancel editing"
                disabled={busy}
                onPress={() => setEditing(false)}
              />
              <WorkspaceButton
                primary
                icon="check"
                label={busy ? 'Saving…' : 'Save'}
                accessibilityLabel="Save profile"
                disabled={incomplete}
                busy={busy}
                onPress={() => void save()}
              />
            </>
          ) : (
            <WorkspaceButton
              primary
              label="Edit"
              accessibilityLabel="Edit profile"
              onPress={() => {
                setName(profile?.name ?? '');
                setMajor(profile?.major ?? '');
                setYear(profile?.year ?? 'Freshman');
                setEditing(true);
                setSaved(false);
              }}
            />
          )
        }
      />

      {error ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${error} Try again.`}
          accessibilityLiveRegion="polite"
          onPress={() => setAttempt((x) => x + 1)}
          style={[styles.notice, { borderColor: theme.border }]}
        >
          <ThemedText style={[styles.noticeText, { color: theme.danger }]}>{error}</ThemedText>
          <ThemedText style={[styles.noticeText, { color: theme.accent }]}>Retry</ThemedText>
        </Pressable>
      ) : null}

      {first ? (
        <SkeletonPage label="Loading your profile" sections={3} />
      ) : (
        <>
          <Section label="Details">
            {editing ? (
              <View
                style={[
                  styles.panel,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                ]}
              >
                <AppTextInput
                  label="Name"
                  accessibilityLabel="Your name"
                  value={name}
                  onChangeText={setName}
                  editable={!busy}
                  autoComplete="name"
                  maxLength={100}
                />
                <ChoiceChips
                  label="Year"
                  options={years}
                  value={year}
                  disabled={busy}
                  onChange={setYear}
                />
                <AppTextInput
                  label="Major or program"
                  value={major}
                  onChangeText={setMajor}
                  editable={!busy}
                  maxLength={160}
                />
              </View>
            ) : (
              <RowGroup>
                <Row first title="Name" meta={[profile?.name || '—']} />
                <Row title="Year" meta={[profile?.year || '—']} />
                <Row title="Major" meta={[profile?.major || '—']} />
              </RowGroup>
            )}
          </Section>

          {saved ? (
            <ThemedText
              accessibilityLiveRegion="polite"
              style={[styles.footnote, { color: theme.textSecondary }]}
            >
              Profile saved{capabilities.mode === 'mock' ? ' for this demo session' : ''}.
            </ThemedText>
          ) : null}

          <Section label="Workspace">
            <RowGroup>
              <Row
                first
                title="Courses"
                meta={['Join or leave']}
                accessibilityHint="Opens your course list"
                onPress={() => router.push('/courses')}
              />
            </RowGroup>
          </Section>

          <Section label="Reminders">
            <RowGroup>
              <View style={styles.setting}>
                <AppIcon name="clock" size={15} color={theme.textSecondary} />
                <View style={styles.settingCopy}>
                  <ThemedText style={styles.settingTitle}>Review reminders</ThemedText>
                  <ThemedText style={[styles.note, { color: theme.textTertiary }]}>
                    {reminders === 'unsupported'
                      ? 'Reminders come from the iPhone and Android app. Here, due reviews show on your Overview.'
                      : reminders === 'denied'
                        ? 'Notifications are off for Chalkwise. Turn them on in your phone’s Settings.'
                        : reminders === 'enabled'
                          ? 'On. One reminder per review, between 9 am and 9 pm.'
                          : 'Off. Turn on to get a reminder when a review is due.'}
                  </ThemedText>
                </View>
                {reminders === 'unsupported' ? null : (
                  <WorkspaceButton
                    primary={reminders !== 'enabled'}
                    label={reminders === 'enabled' ? 'Turn off' : 'Turn on'}
                    accessibilityLabel={
                      reminders === 'enabled'
                        ? 'Turn off review reminders'
                        : 'Turn on review reminders'
                    }
                    busy={reminderBusy}
                    onPress={() => void toggleReminders()}
                  />
                )}
              </View>
            </RowGroup>
          </Section>

          <Section label="Sharing">
            <View
              style={[
                styles.panel,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
                {capabilities.mode === 'api'
                  ? 'Notebooks start private. Share a notebook with accepted friends in the same course, and turn sharing off at any time.'
                  : capabilities.mode === 'mock'
                    ? 'This workspace uses sample data. Nothing in the demo is uploaded.'
                    : 'This workspace uses the existing legacy sharing model.'}
              </ThemedText>
              <ThemedText style={[styles.note, { color: theme.textTertiary }]}>
                Appearance follows your device&apos;s light or dark setting. Capture only material
                you have permission to save and share.
              </ThemedText>
            </View>
          </Section>

          <Section label="Account">
            {capabilities.mode === 'mock' ? (
              <RowGroup>
                <Row first title="Demo workspace" meta={['No account signed in']} />
              </RowGroup>
            ) : (
              <RowGroup>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  accessibilityState={{ disabled: busy, busy }}
                  disabled={busy}
                  onPress={() => void leave()}
                  style={({ pressed, hovered }) => [
                    styles.signOut,
                    (pressed || hovered) && { backgroundColor: theme.backgroundHover },
                    busy && styles.dim,
                  ]}
                >
                  <ThemedText style={[styles.signOutLabel, { color: theme.danger }]}>
                    {busy ? 'Please wait…' : 'Sign out'}
                  </ThemedText>
                </Pressable>
              </RowGroup>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.85 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  noticeText: { fontSize: 12.5, lineHeight: 18, fontWeight: '500' },
  panel: { gap: 14, padding: 14, borderWidth: 1, borderRadius: Radius.large },
  note: { fontSize: 12.5, lineHeight: 18 },
  signOut: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  signOutLabel: { fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  footnote: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
  },
  settingCopy: { flex: 1, minWidth: 0, gap: 2 },
  settingTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
});
