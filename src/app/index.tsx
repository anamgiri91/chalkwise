import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppIcon } from '@/components/ui/AppIcon';
import { Row, RowGroup, Section, Toolbar, since } from '@/components/ui/DataRow';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { SkeletonPage } from '@/components/ui/Skeleton';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getStudyDashboard, getWorkspaceCapabilities } from '@/services/study';
import { getInitials } from '@/features/profile/initials';
import { getCatchupFeed, type CatchupGap } from '@/services/catchup';
import { getMeetings } from '@/services/schedule';
import { formatClock, nextMeeting, WEEKDAYS } from '@/features/courses/schedule';
import type { CourseMeeting } from '@/types';
import {
  getReminderStatus,
  syncReviewReminders,
  turnOnReviewReminders,
  type ReminderStatus,
} from '@/services/reminders';

const MAX_ROWS = 6;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function HomeScreen() {
  const theme = useTheme();
  const [data, setData] = useState<Awaited<ReturnType<typeof getStudyDashboard>> | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const capabilities = getWorkspaceCapabilities();
  const [reminders, setReminders] = useState<ReminderStatus>('unsupported');
  const [reminderBusy, setReminderBusy] = useState(false);
  const [gap, setGap] = useState<CatchupGap | null>(null);
  const [meetings, setMeetings] = useState<CourseMeeting[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      getStudyDashboard()
        .then((result) => {
          if (!active) return;
          setData(result);
          // Keep device reminders in step with reviews saved on any device.
          void syncReviewReminders(result.lectures, result.reviews).catch(() => {});
          // Surface the most recent class a classmate can help with; never block the page.
          void getCatchupFeed(result.lectures)
            .then((feed) => {
              if (active) setGap(feed.gaps.find((item) => item.notes.length) ?? null);
            })
            .catch(() => {});
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not open your workspace.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      void getMeetings()
        .then((value) => {
          if (active) setMeetings(value);
        })
        .catch(() => {});
      void getReminderStatus()
        .then((status) => {
          if (active) setReminders(status);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [attempt]),
  );

  async function turnOnReminders() {
    setReminderBusy(true);
    try {
      setReminders(await turnOnReviewReminders());
    } catch {
      setReminders('disabled');
    } finally {
      setReminderBusy(false);
    }
  }

  const courseFor = (id: string) => data?.courses.find((course) => course.id === id);
  const label = (id: string) => courseFor(id)?.code ?? 'No course';
  const query = search.trim().toLowerCase();
  const results =
    data?.lectures.filter((note) =>
      `${note.title} ${note.summary} ${label(note.courseId)}`.toLowerCase().includes(query),
    ) ?? [];
  const due = data?.queue ?? [];
  const open = (id: string) => router.push({ pathname: '/lecture/[id]', params: { id } });
  // One line that answers "what now?": reviews waiting and the next class.
  const upcoming = nextMeeting(meetings, new Date());
  const today = data
    ? [
        due.length ? plural(due.length, 'review') + ' due' : 'All caught up on reviews',
        upcoming
          ? `Next class: ${courseFor(upcoming.meeting.courseId)?.code ?? 'class'}, ${
              upcoming.startsAt.toDateString() === new Date().toDateString()
                ? 'today'
                : WEEKDAYS[upcoming.meeting.weekday]
            } ${formatClock(upcoming.meeting.start)}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <Screen showBottomNav wide>
      <Toolbar
        title="Overview"
        description={today}
        actions={
          <>
            <WorkspaceButton
              primary
              icon="plus"
              label="Capture"
              accessibilityLabel="Capture class material"
              onPress={() => router.push('/capture')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              onPress={() => router.push('/profile')}
              style={({ hovered }) => [
                styles.avatar,
                { backgroundColor: theme.backgroundSelected },
                hovered && styles.dim,
              ]}
            >
              <ThemedText style={styles.avatarText}>
                {getInitials(data?.profile?.name ?? 'Student')}
              </ThemedText>
            </Pressable>
          </>
        }
      />

      <View
        style={[
          styles.search,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
      >
        <AppIcon name="search" size={15} color={theme.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search notebooks and courses"
          placeholderTextColor={theme.textTertiary}
          accessibilityLabel="Search notebooks and courses"
          style={[styles.input, { color: theme.text }]}
        />
      </View>

      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAttempt((x) => x + 1)}
          style={[styles.notice, { borderColor: theme.border }]}
        >
          <ThemedText style={[styles.noticeText, { color: theme.danger }]}>{error}</ThemedText>
          <ThemedText style={[styles.noticeText, { color: theme.accent }]}>Retry</ThemedText>
        </Pressable>
      ) : null}

      {loading && !data ? (
        <SkeletonPage label="Loading workspace" sections={3} />
      ) : query ? (
        <Section label="Search results" count={results.length}>
          <RowGroup>
            {results.length ? (
              results
                .slice(0, 20)
                .map((note, index) => (
                  <Row
                    key={note.id}
                    first={index === 0}
                    title={note.title}
                    meta={[label(note.courseId), since(note.createdAt)]}
                    onPress={() => open(note.id)}
                  />
                ))
            ) : (
              <Row first title="No matches" meta={['Try a course code or concept']} />
            )}
          </RowGroup>
        </Section>
      ) : (
        <>
          {reminders === 'disabled' && data?.lectures.length ? (
            <View
              style={[
                styles.prompt,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}
            >
              <AppIcon name="clock" size={16} color={theme.textSecondary} />
              <View style={styles.promptCopy}>
                <ThemedText style={styles.promptTitle}>Get a nudge when a review is due</ThemedText>
                <ThemedText style={[styles.promptText, { color: theme.textSecondary }]}>
                  One reminder per review, only between 9 am and 9 pm.
                </ThemedText>
              </View>
              <WorkspaceButton
                label={reminderBusy ? 'Turning on…' : 'Turn on'}
                accessibilityLabel="Turn on review reminders"
                busy={reminderBusy}
                onPress={() => void turnOnReminders()}
              />
            </View>
          ) : null}

          {gap ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens CatchUp"
              onPress={() => router.push('/catchup')}
              style={({ pressed, hovered }) => [
                styles.prompt,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                (pressed || hovered) && { backgroundColor: theme.backgroundHover },
              ]}
            >
              <AppIcon name="users" size={16} color={theme.accent} />
              <View style={styles.promptCopy}>
                <ThemedText style={styles.promptTitle}>
                  No notes from {gap.startsAt.toLocaleDateString('en-US', { weekday: 'long' })}
                  &apos;s {gap.course?.code ?? 'class'}
                </ThemedText>
                <ThemedText style={[styles.promptText, { color: theme.textSecondary }]}>
                  {gap.notes[0].sharedBy?.name.split(' ')[0] ?? 'A classmate'} shared “
                  {gap.notes[0].lecture.title}”
                  {gap.notes.length > 1 ? ` and ${gap.notes.length - 1} more` : ''}.
                </ThemedText>
              </View>
              <AppIcon name="chevron" size={15} color={theme.textTertiary} />
            </Pressable>
          ) : null}

          {due.length ? (
            <Section label="Due for review" count={due.length}>
              <RowGroup>
                {due.slice(0, MAX_ROWS).map((item, index) => (
                  <Row
                    key={item.lecture.id}
                    first={index === 0}
                    title={item.lecture.title}
                    meta={[label(item.lecture.courseId), item.reason]}
                    onPress={() => open(item.lecture.id)}
                  />
                ))}
              </RowGroup>
            </Section>
          ) : null}

          <Section label="Notebooks" count={data?.lectures.length ?? 0}>
            <RowGroup>
              {data?.lectures.length ? (
                data.lectures
                  .slice(0, MAX_ROWS)
                  .map((note, index) => (
                    <Row
                      key={note.id}
                      first={index === 0}
                      title={note.title}
                      meta={[label(note.courseId), since(note.createdAt)]}
                      onPress={() => open(note.id)}
                    />
                  ))
              ) : (
                <Row
                  first
                  title="No notebooks yet"
                  meta={['Capture a board or a page to start']}
                  onPress={() => router.push('/capture')}
                />
              )}
            </RowGroup>
          </Section>

          <Section
            label="Courses"
            count={data?.courses.length ?? 0}
            action="Manage"
            onAction={() => router.push('/courses')}
          >
            <RowGroup>
              {data?.courses.length ? (
                data.courses.map((course, index) => (
                  <Row
                    key={course.id}
                    first={index === 0}
                    title={course.name}
                    meta={[
                      course.code,
                      plural(
                        data.lectures.filter((n) => n.courseId === course.id).length,
                        'notebook',
                      ),
                    ]}
                    onPress={() =>
                      router.push({ pathname: '/course/[id]', params: { id: course.id } })
                    }
                  />
                ))
              ) : (
                <Row
                  first
                  title="No courses yet"
                  meta={['Add the classes you are taking']}
                  onPress={() => router.push('/courses')}
                />
              )}
            </RowGroup>
          </Section>
        </>
      )}

      {capabilities.mode === 'mock' || data?.partial ? (
        <ThemedText style={[styles.footnote, { color: theme.textTertiary }]}>
          {data?.partial
            ? 'Some notebooks could not load.'
            : 'Demo data. Changes reset when you reload.'}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 30,
    height: 30,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11.5, fontWeight: '600' },
  dim: { opacity: 0.85 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  input: { flex: 1, fontSize: 13.5, outlineStyle: 'none' } as object,
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
  footnote: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: Radius.large,
  },
  promptCopy: { flex: 1, minWidth: 0, gap: 2 },
  promptTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  promptText: { fontSize: 12.5, lineHeight: 18 },
});
