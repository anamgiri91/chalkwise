import { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppTextInput, FormError } from '@/components/ui/AppTextInput';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { Radius, Scrim } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInitials } from '@/features/profile/initials';

import { getCurrentUserId } from '@/services/auth';
import {
  acceptDemoFriendship,
  acceptFriendRequest,
  getFriendshipStates,
  getIncomingRequests,
  searchProfiles,
  sendFriendRequest,
} from '@/services/friends';
import type { FriendRequest, Profile } from '@/types';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Lets Catch Up reload its friend list after a request is accepted. */
  onChanged: () => void;
};

export function AddFriendSheet({ visible, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  // Wide screens get a centered dialog; a bottom sheet suits phones only.
  const dialog = width >= 720;

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [states, setStates] = useState<Map<string, 'pending' | 'accepted'>>(new Map());
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searching, setSearching] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [incoming, current] = await Promise.all([getIncomingRequests(), getFriendshipStates()]);
      setRequests(incoming);
      setStates(current);
    } catch (caught) {
      setError(message(caught));
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setError('');
    // Friendships are authenticated-only by design, so check before querying.
    void getCurrentIn();

    async function getCurrentIn() {
      try {
        const id = await getCurrentUserId();
        if (!active) return;
        setSignedIn(id !== null);
        if (id) await refresh();
      } catch {
        if (active) setSignedIn(false);
      }
    }

    return () => {
      active = false;
    };
  }, [visible, refresh]);

  // Debounced so typing does not fire a query per keystroke.
  useEffect(() => {
    if (!visible || !signedIn) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchProfiles(term)
        .then((found) => {
          if (active) setResults(found);
        })
        .catch((caught) => {
          if (active) setError(message(caught));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, visible, signedIn]);

  function close() {
    if (working) return;
    setQuery('');
    setResults([]);
    setError('');
    onClose();
  }

  async function add(profile: Profile) {
    if (working) return;
    setWorking(profile.id);
    setError('');
    try {
      // The seeded demo classmate has no account to accept from, so it uses the
      // demo-scoped path. Real classmates always go through a real request.
      if (profile.isDemo) {
        await acceptDemoFriendship(profile.id);
        onChanged();
      } else {
        await sendFriendRequest(profile.id);
      }
      await refresh();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setWorking(null);
    }
  }

  async function accept(request: FriendRequest) {
    if (working) return;
    setWorking(request.id);
    setError('');
    try {
      await acceptFriendRequest(request.id);
      await refresh();
      onChanged();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setWorking(null);
    }
  }

  // An absolute number beats a percentage here: the sheet's parent is
  // content-sized, so a percentage maxHeight resolves against nothing.
  const sheetMax = Math.round(height * 0.75);

  const rowStyle = [
    styles.row,
    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
  ];
  const avatar = (name: string) => (
    <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText allowFontScaling={false} style={styles.avatarText}>
        {getInitials(name) || '··'}
      </ThemedText>
    </View>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType={dialog ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={[styles.root, dialog && styles.dialogRoot]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.lift, dialog && styles.dialogLift]}
        >
          <View
            style={[
              styles.sheet,
              { maxHeight: sheetMax, backgroundColor: theme.background },
              dialog
                ? [styles.dialog, { borderColor: theme.border }]
                : { paddingBottom: insets.bottom + 16 },
            ]}
          >
            {dialog ? null : (
              <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
            )}

            <View style={styles.header}>
              <ThemedText accessibilityRole="header" style={styles.title}>
                Add a classmate
              </ThemedText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                onPress={close}
                style={({ pressed, hovered }) => [
                  styles.close,
                  (pressed || hovered) && { backgroundColor: theme.backgroundHover },
                ]}
              >
                <AppIcon name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>

            {signedIn === null ? (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Loading" />
              </View>
            ) : signedIn === false ? (
              <View style={styles.signedOut}>
                <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
                  Sign in to add classmates. Catch Up shares notes between real accounts, so friends
                  need you signed in.
                </ThemedText>
                <AppButton
                  title="Sign in"
                  onPress={() => {
                    onClose();
                    router.push('/login');
                  }}
                />
              </View>
            ) : (
              <>
                <AppTextInput
                  label="Find a classmate"
                  accessibilityLabel="Search classmates by name"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by name"
                  autoCapitalize="words"
                  autoCorrect={false}
                />

                <ScrollView
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                >
                  {requests.length ? (
                    <View style={styles.group}>
                      <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                        Friend requests
                      </ThemedText>

                      {requests.map((request) => (
                        <View key={request.id} style={rowStyle}>
                          {avatar(request.from.name)}
                          <View style={styles.rowCopy}>
                            <ThemedText style={styles.rowName}>{request.from.name}</ThemedText>
                            <ThemedText style={[styles.rowMeta, { color: theme.textSecondary }]}>
                              {request.from.year} · {request.from.major}
                            </ThemedText>
                          </View>
                          <WorkspaceButton
                            primary
                            label={working === request.id ? 'Accepting…' : 'Accept'}
                            accessibilityLabel={`Accept ${request.from.name}`}
                            busy={working === request.id}
                            disabled={working !== null}
                            onPress={() => accept(request)}
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {searching ? (
                    <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Searching" />
                  ) : null}

                  {!searching && query.trim().length >= 2 && results.length === 0 ? (
                    <ThemedText style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      No classmate found with that name.
                    </ThemedText>
                  ) : null}

                  {!searching && query.trim().length < 2 && requests.length === 0 ? (
                    <ThemedText style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      Type at least two letters of a classmate&apos;s name to find them.
                    </ThemedText>
                  ) : null}

                  {results.map((profile) => {
                    const state = states.get(profile.id);
                    return (
                      <View key={profile.id} style={rowStyle}>
                        {avatar(profile.name)}
                        <View style={styles.rowCopy}>
                          <ThemedText style={styles.rowName}>{profile.name}</ThemedText>
                          <ThemedText style={[styles.rowMeta, { color: theme.textSecondary }]}>
                            {profile.year} · {profile.major}
                          </ThemedText>
                        </View>
                        {state ? (
                          <View style={[styles.badge, { borderColor: theme.border }]}>
                            <ThemedText style={[styles.badgeText, { color: theme.textSecondary }]}>
                              {state === 'accepted' ? 'Friends' : 'Pending'}
                            </ThemedText>
                          </View>
                        ) : (
                          <WorkspaceButton
                            primary
                            label={working === profile.id ? 'Adding…' : 'Add'}
                            accessibilityLabel={`Add ${profile.name}`}
                            busy={working === profile.id}
                            disabled={working !== null}
                            onPress={() => add(profile)}
                          />
                        )}
                      </View>
                    );
                  })}

                  <FormError message={error} />
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: Scrim },
  dialogRoot: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  lift: { width: '100%' },
  dialogLift: { maxWidth: 480 },

  sheet: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  dialog: {
    borderRadius: Radius.large,
    borderWidth: 1,
    paddingTop: 20,
    paddingBottom: 20,
  },

  handle: { width: 38, height: 4, borderRadius: Radius.pill, alignSelf: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  close: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // flexShrink lets the list give way to the keyboard instead of pushing the
  // sheet past the bottom of the screen.
  list: { flexShrink: 1 },
  listContent: { gap: 8, paddingBottom: 4 },

  group: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12.5, fontWeight: '600' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  rowMeta: { fontSize: 13, lineHeight: 19 },

  badge: {
    minHeight: 32,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  badgeText: { fontSize: 13, fontWeight: '600' },

  signedOut: { gap: 14, paddingBottom: 4 },
  body: { fontSize: 15, lineHeight: 23 },
  centered: { paddingVertical: 28, alignItems: 'center' },
});
