import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AddFriendSheet } from '@/components/AddFriendSheet';
import { AppIcon } from '@/components/ui/AppIcon';
import { Row, RowGroup, Section, Toolbar, since } from '@/components/ui/DataRow';
import { SkeletonPage } from '@/components/ui/Skeleton';
import { Screen } from '@/components/ui/Screen';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCatchupFeed } from '@/services/catchup';
import { copyLectureToMyNotes } from '@/services/lectures';
import { getWorkspaceCapabilities } from '@/services/study';

/**
 * CatchUp: the classmates whose requests were accepted, and the notebooks they
 * share with this account.
 *
 * Listing a notebook here is the result of a permission, never a grant of one:
 * the friendship must be accepted, and in API mode the author must also have
 * shared that notebook with friends enrolled in its course. Those rules differ
 * per adapter, so the note under Friends states the one this workspace applies.
 */

/** Whose notes a friendship exposes, which is not the same in every workspace. */
const sharingNote: Record<ReturnType<typeof getWorkspaceCapabilities>['mode'], string> = {
  api: 'Friendship alone does not share your notes. Choose what to share from each notebook.',
  mock: 'This demo has no live classmates. A connected workspace supports friend requests and shared notes.',
  supabase: 'Your legacy workspace keeps its existing friend-sharing settings.',
};

export default function CatchupScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<Awaited<ReturnType<typeof getCatchupFeed>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [friendOpen, setFriendOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copies, setCopies] = useState<Record<string, string>>({});
  const capabilities = getWorkspaceCapabilities();
  // Friendships are an account feature; the demo workspace has no one to add.
  const canAddFriends = capabilities.mode !== 'mock';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      getCatchupFeed()
        .then((result) => {
          if (active) setData(result);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not load shared notes.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );

  async function copy(id: string) {
    if (busy) return;
    setBusy(id);
    setCopyError('');
    try {
      const result = await copyLectureToMyNotes(id);
      setCopies((value) => ({ ...value, [id]: result.id }));
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'Could not copy these notes.');
    } finally {
      setBusy(null);
    }
  }

  const friends = data?.friends ?? [];
  const notes = data?.notes ?? [];
  // Metadata columns are fixed width, so a narrow screen drops the ones it can
  // afford to lose rather than squeezing the notebook title out of the row.
  const columns = width >= 700 ? 3 : width >= 500 ? 2 : 1;

  return (
    <>
      <Screen showBottomNav wide>
        <Toolbar
          title="CatchUp"
          actions={
            canAddFriends ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a classmate"
                accessibilityHint="Opens classmate search and incoming friend requests"
                onPress={() => setFriendOpen(true)}
                style={({ pressed, hovered }) => [
                  styles.primary,
                  { backgroundColor: theme.accent },
                  (pressed || hovered) && styles.dim,
                ]}
              >
                <AppIcon name="plus" size={14} color={theme.accentText} />
                <ThemedText style={[styles.primaryLabel, { color: theme.accentText }]}>
                  Add classmate
                </ThemedText>
              </Pressable>
            ) : null
          }
        />

        {error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${error} Retry.`}
            accessibilityLiveRegion="polite"
            onPress={() => setAttempt((x) => x + 1)}
            style={[styles.notice, { borderColor: theme.border }]}
          >
            <ThemedText style={[styles.noticeText, { color: theme.danger }]}>{error}</ThemedText>
            <ThemedText style={[styles.noticeText, { color: theme.accent }]}>Retry</ThemedText>
          </Pressable>
        ) : null}

        {loading && !data ? (
          <SkeletonPage label="Loading shared notebooks" />
        ) : (
          <>
            <Section
              label="Friends"
              count={friends.length}
              action={canAddFriends ? 'Requests' : undefined}
              onAction={() => setFriendOpen(true)}
            >
              <RowGroup>
                {friends.length ? (
                  friends.map((friend, index) => (
                    <Row
                      key={friend.id}
                      first={index === 0}
                      title={friend.name}
                      meta={[columns >= 2 ? friend.year : null, friend.major]}
                    />
                  ))
                ) : (
                  <Row
                    first
                    title="No friends yet"
                    meta={[canAddFriends ? 'Send a classmate a request' : 'Demo workspace']}
                    onPress={canAddFriends ? () => setFriendOpen(true) : undefined}
                  />
                )}
              </RowGroup>
              <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
                {sharingNote[capabilities.mode]}
              </ThemedText>
            </Section>

            <Section label="Shared notebooks" count={notes.length}>
              <RowGroup>
                {notes.length ? (
                  notes.map((item, index) => {
                    const id = item.lecture.id;
                    const mine = copies[id];
                    const name = item.sharedBy?.name ?? 'A classmate';
                    const shortened = columns === 1 ? name.split(' ')[0] : name;
                    const credit = item.demo ? `${shortened} · Demo` : shortened;
                    return (
                      <Row
                        key={id}
                        first={index === 0}
                        title={item.lecture.title}
                        meta={[
                          columns >= 3 ? (item.course?.code ?? 'No course') : null,
                          credit,
                          columns >= 2 ? since(item.lecture.createdAt) : null,
                        ]}
                        accessibilityHint="Opens the notebook this classmate shared"
                        onPress={() => router.push({ pathname: '/lecture/[id]', params: { id } })}
                        trailing={
                          mine ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Open my copy of ${item.lecture.title}`}
                              onPress={(event) => {
                                event.stopPropagation();
                                router.push({ pathname: '/lecture/[id]', params: { id: mine } });
                              }}
                              style={({ pressed, hovered }) => [
                                styles.action,
                                {
                                  borderColor: theme.accent,
                                  backgroundColor: theme.accentSurface,
                                },
                                (pressed || hovered) && styles.dim,
                              ]}
                            >
                              <ThemedText style={[styles.actionLabel, { color: theme.accent }]}>
                                Open my copy
                              </ThemedText>
                            </Pressable>
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Add ${item.lecture.title} to my notes`}
                              accessibilityHint="Copies the notes and the original photos into a new notebook you own"
                              disabled={busy !== null}
                              onPress={(event) => {
                                event.stopPropagation();
                                void copy(id);
                              }}
                              style={({ pressed, hovered }) => [
                                styles.action,
                                {
                                  borderColor: theme.borderStrong,
                                  backgroundColor:
                                    pressed || hovered
                                      ? theme.backgroundSelected
                                      : theme.backgroundElement,
                                },
                                busy !== null && styles.faded,
                              ]}
                            >
                              <ThemedText style={[styles.actionLabel, { color: theme.text }]}>
                                {busy === id ? 'Copying…' : 'Add to my notes'}
                              </ThemedText>
                            </Pressable>
                          )
                        }
                      />
                    );
                  })
                ) : (
                  <Row
                    first
                    title="No shared notebooks"
                    meta={['Listed once a friend shares one']}
                  />
                )}
              </RowGroup>
            </Section>
          </>
        )}

        {copyError ? (
          <ThemedText
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.noticeText, { color: theme.danger }]}
          >
            {copyError}
          </ThemedText>
        ) : null}

        <ThemedText style={[styles.footnote, { color: theme.textTertiary }]}>
          Adding a notebook copies its notes and original photos into a new notebook you own. The
          classmate&apos;s notebook is not changed.
        </ThemedText>
      </Screen>
      <AddFriendSheet
        visible={friendOpen}
        onClose={() => setFriendOpen(false)}
        onChanged={() => setAttempt((x) => x + 1)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: Radius.medium,
  },
  primaryLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  dim: { opacity: 0.85 },
  faded: { opacity: 0.5 },
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
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: Radius.small,
  },
  actionLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  note: { fontSize: 12.5, lineHeight: 18 },
  footnote: { fontSize: 12, lineHeight: 16, marginTop: 4 },
});
