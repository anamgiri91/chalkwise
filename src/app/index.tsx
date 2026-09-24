import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppIcon } from '@/components/ui/AppIcon';
import { Row, RowGroup, Section, Toolbar, since } from '@/components/ui/DataRow';
import { SkeletonPage } from '@/components/ui/Skeleton';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getStudyDashboard, getWorkspaceCapabilities } from '@/services/study';
import { getInitials } from '@/features/profile/initials';

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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      getStudyDashboard()
        .then((result) => {
          if (active) setData(result);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not open your workspace.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );

  const courseFor = (id: string) => data?.courses.find((course) => course.id === id);
  const label = (id: string) => courseFor(id)?.code ?? 'No course';
  const query = search.trim().toLowerCase();
  const results =
    data?.lectures.filter((note) =>
      `${note.title} ${note.summary} ${label(note.courseId)}`.toLowerCase().includes(query),
    ) ?? [];
  const due = data?.queue ?? [];
  const open = (id: string) => router.push({ pathname: '/lecture/[id]', params: { id } });

  return (
    <Screen showBottomNav wide>
      <Toolbar
        title="Overview"
        actions={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capture class material"
              onPress={() => router.push('/capture')}
              style={({ pressed, hovered }) => [
                styles.primary,
                { backgroundColor: theme.accent },
                (pressed || hovered) && styles.dim,
              ]}
            >
              <AppIcon name="plus" size={14} color={theme.accentText} />
              <ThemedText style={[styles.primaryLabel, { color: theme.accentText }]}>
                Capture
              </ThemedText>
            </Pressable>
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
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: Radius.medium,
  },
  primaryLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
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
});
