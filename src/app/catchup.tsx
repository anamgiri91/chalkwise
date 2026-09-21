import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { EmptyState, StatusBadge, formatDate } from '@/components/ui/Editorial';
import { ThemedText } from '@/components/themed-text';
import { AddFriendSheet } from '@/components/AddFriendSheet';
import { getCatchupFeed } from '@/services/catchup';
import { copyLectureToMyNotes } from '@/services/lectures';
import { getWorkspaceCapabilities } from '@/services/study';

export default function CatchupScreen() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCatchupFeed>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [friendOpen, setFriendOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copies, setCopies] = useState<Record<string, string>>({});
  const capabilities = getWorkspaceCapabilities();
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
  return (
    <>
      <Screen showBottomNav>
        <StatusBadge label="LEARN TOGETHER" />
        <ThemedText type="title">A classmate's perspective.</ThemedText>
        <ThemedText themeColor="textSecondary">
          Find notes your classmates have shared. Compare an explanation, fill a gap, and keep a
          copy in your own notebook.
        </ThemedText>
        <AppCard>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <AppIcon name="users" />
            <ThemedText style={{ fontWeight: '600', fontSize: 20 }}>
              {data?.friends.length ?? 0} connected classmates
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">
            {capabilities.mode === 'api'
              ? 'Friendship alone does not share your notes. Choose what to share from each notebook.'
              : capabilities.mode === 'mock'
                ? 'This demo has no live classmates. Your connected workspace supports friend requests and shared notes.'
                : 'Your legacy workspace keeps its existing friend-sharing settings.'}
          </ThemedText>
          {capabilities.mode !== 'mock' ? (
            <AppButton
              secondary
              title="Find classmates & requests"
              onPress={() => setFriendOpen(true)}
            />
          ) : null}
        </AppCard>
        {loading ? (
          <EmptyState
            loading
            title="Finding shared notes"
            description="Checking your accepted connections."
          />
        ) : error ? (
          <EmptyState
            title="Shared notes couldn't load"
            description={error}
            action="Try again"
            onPress={() => setAttempt((x) => x + 1)}
          />
        ) : data?.notes.length ? (
          data.notes.map((item) => (
            <AppCard key={item.lecture.id}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <StatusBadge label={item.course?.code ?? 'COURSE'} />
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(item.lecture.createdAt)}
                </ThemedText>
              </View>
              <ThemedText type="subtitle" style={{ fontSize: 24, lineHeight: 32 }}>
                {item.lecture.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Shared by {item.sharedBy?.name ?? 'a classmate'}
                {item.demo ? ' · Demo notebook' : ''}
              </ThemedText>
              <ThemedText numberOfLines={3}>{item.lecture.summary}</ThemedText>
              <AppButton
                secondary
                title="Read shared notebook"
                onPress={() =>
                  router.push({ pathname: '/lecture/[id]', params: { id: item.lecture.id } })
                }
              />
              {copies[item.lecture.id] ? (
                <AppButton
                  title="Open my copy"
                  onPress={() =>
                    router.push({
                      pathname: '/lecture/[id]',
                      params: { id: copies[item.lecture.id] },
                    })
                  }
                />
              ) : (
                <AppButton
                  title={
                    busy === item.lecture.id ? 'Copying originals and notes…' : 'Add to my notes'
                  }
                  disabled={busy !== null}
                  onPress={() => copy(item.lecture.id)}
                />
              )}
            </AppCard>
          ))
        ) : (
          <EmptyState
            title="A little help, when you need it"
            description="Shared notebooks will appear here when classmates choose to share with you. No uploads does not mean you missed class."
          />
        )}
        {copyError ? <ThemedText accessibilityRole="alert">{copyError}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          Adding notes creates an independent copy. Read the original material and give your
          classmate credit.
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
