import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/ui/Editorial';
import { CourseCard } from '@/components/CourseCard';
import { LectureCard } from '@/components/LectureCard';
import { Brand, Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getStudyDashboard, getWorkspaceCapabilities } from '@/services/study';
import { getInitials } from '@/features/profile/initials';

export default function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
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
  const retry = () => setAttempt((x) => x + 1);
  const columns = width >= 1250 || (width >= 760 && width < 1000);
  const courseFor = (id: string) => data?.courses.find((course) => course.id === id);
  const query = search.trim().toLowerCase();
  const results =
    data?.lectures.filter((note) =>
      `${note.title} ${note.summary} ${courseFor(note.courseId)?.code}`
        .toLowerCase()
        .includes(query),
    ) ?? [];
  const due = data?.queue ?? [];
  return (
    <Screen showBottomNav wide>
      <View style={styles.topbar}>
        <View style={{ gap: 4 }}>
          <ThemedText style={styles.wordmark}>Your workspace</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push('/profile')}
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}
        >
          <ThemedText type="smallBold">{getInitials(data?.profile?.name ?? 'Student')}</ThemedText>
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <AppIcon name="search" color={theme.textSecondary} size={20} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search your lecture notes"
          placeholder="Find a concept, course, or notebook…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch('')}
            style={{ padding: 8 }}
          >
            <ThemedText>×</ThemedText>
          </Pressable>
        ) : null}
      </View>
      {capabilities.mode === 'mock' ? (
        <View style={[styles.demo, { backgroundColor: theme.backgroundSelected }]}>
          <AppIcon name="eye" />
          <ThemedText type="small" style={{ flex: 1 }}>
            Demo workspace · Explore sample notes and try a review. Changes reset on reload.
          </ThemedText>
        </View>
      ) : null}
      {loading && !data ? (
        <EmptyState
          loading
          title="Opening your workspace"
          description="Finding your courses and next review."
        />
      ) : error ? (
        <EmptyState
          title="Let's reconnect"
          description={error}
          action="Try again"
          onPress={retry}
        />
      ) : data ? (
        <>
          {data.partial ? (
            <AppButton secondary title="Some notebooks could not load · Retry" onPress={retry} />
          ) : null}
          {query ? (
            <View style={styles.section}>
              <SectionHeader title="Search results" detail={`${results.length} found`} />
              {results.length ? (
                results.map((lecture) => <LectureCard key={lecture.id} lecture={lecture} />)
              ) : (
                <EmptyState
                  title="No matching notes"
                  description="Try a course code or another concept."
                />
              )}
            </View>
          ) : (
            <>
              <View style={styles.intro}>
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.textSecondary, letterSpacing: 1.6 }}
                >
                  A LITTLE PROGRESS, EVERY DAY
                </ThemedText>
                <ThemedText type="title" style={styles.title}>
                  Welcome back, {data.profile?.name.split(' ')[0] ?? 'student'}.
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Turn what happened in class into something that stays with you.
                </ThemedText>
              </View>
              <View style={styles.stats}>
                <Stat value={data.courses.length} label="Courses" />
                <Stat value={data.lectures.length} label="Notebooks" />
                <Stat
                  value={due.length}
                  label={capabilities.reviews ? 'Ready to review' : 'Saved for study'}
                />
              </View>
              <View style={[styles.columns, columns && styles.row]}>
                <View style={[styles.mainColumn, columns && { flex: 1.6 }]}>
                  <View style={styles.focus}>
                    <View style={styles.focusTop}>
                      <View style={styles.focusLabel}>
                        <AppIcon name="spark" color="#BED1FF" size={18} />
                        <ThemedText style={styles.focusEyebrow}>YOUR NEXT SMALL STEP</ThemedText>
                      </View>
                      <ThemedText style={{ color: '#BED1FF', fontSize: 13 }}>01 / FOCUS</ThemedText>
                    </View>
                    <ThemedText accessibilityRole="header" style={styles.focusTitle}>
                      {due[0]
                        ? `Make ${due[0].lecture.title.toLowerCase()} stick.`
                        : 'Start with a moment from class.'}
                    </ThemedText>
                    <ThemedText style={styles.focusDescription}>
                      {due[0]
                        ? 'Before reading your notes, try explaining one key idea in your own words. Then check the original.'
                        : 'Capture a slide, a whiteboard, or a page of notes. Keep the original beside your study material.'}
                    </ThemedText>
                    <View style={{ alignSelf: 'flex-start' }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          due[0] ? 'Start a review' : 'Capture your first lecture'
                        }
                        onPress={() =>
                          due[0]
                            ? router.push({
                                pathname: '/lecture/[id]',
                                params: { id: due[0].lecture.id },
                              })
                            : router.push('/capture')
                        }
                        style={({ pressed }) => [styles.focusButton, pressed && { opacity: 0.8 }]}
                      >
                        <ThemedText style={{ color: Brand.navy, fontWeight: '700' }}>
                          {due[0] ? 'Start a review' : 'Capture a lecture'}
                        </ThemedText>
                        <AppIcon name="arrow" color={Brand.navy} size={18} />
                      </Pressable>
                    </View>
                    {due[0] ? (
                      <ThemedText style={{ color: '#BED1FF', fontSize: 13 }}>
                        {courseFor(due[0].lecture.courseId)?.code} · {due[0].reason}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.section}>
                    <SectionHeader title="Pick up where you left off" detail="Recent notebooks" />
                    {data.lectures.length ? (
                      data.lectures
                        .slice(0, 3)
                        .map((lecture) => <LectureCard key={lecture.id} lecture={lecture} />)
                    ) : (
                      <EmptyState
                        title="Your first notebook awaits"
                        description="A photo is a good place to start."
                        action="Capture a lecture"
                        onPress={() => router.push('/capture')}
                      />
                    )}
                  </View>
                </View>
                <View style={[styles.mainColumn, columns && { flex: 1 }]}>
                  <AppCard>
                    <View style={styles.focusLabel}>
                      <AppIcon name="camera" />
                      <ThemedText style={{ fontWeight: '700', fontSize: 20 }}>
                        Keep the original.
                      </ThemedText>
                    </View>
                    <ThemedText themeColor="textSecondary">
                      Your photos are the source. AI notes help organize them, and you stay in
                      control.
                    </ThemedText>
                    <AppButton
                      title="Capture class material"
                      onPress={() => router.push('/capture')}
                    />
                  </AppCard>
                  <AppCard>
                    <SectionHeader title="Review queue" detail={`${due.length} ready`} />
                    {due.length ? (
                      due.slice(0, 3).map((item, index) => (
                        <Pressable
                          key={item.lecture.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Review ${item.lecture.title}`}
                          onPress={() =>
                            router.push({
                              pathname: '/lecture/[id]',
                              params: { id: item.lecture.id },
                            })
                          }
                          style={styles.queueRow}
                        >
                          <ThemedText themeColor="textSecondary" style={styles.queueIndex}>
                            {String(index + 1).padStart(2, '0')}
                          </ThemedText>
                          <View style={{ flex: 1, gap: 3 }}>
                            <ThemedText style={{ fontSize: 15, fontWeight: '600' }}>
                              {item.lecture.title}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {courseFor(item.lecture.courseId)?.code} · {item.reason}
                            </ThemedText>
                          </View>
                          <AppIcon name="arrow" size={17} color={theme.textSecondary} />
                        </Pressable>
                      ))
                    ) : (
                      <ThemedText themeColor="textSecondary">
                        You're caught up for now. Your next review will appear when it's ready.
                      </ThemedText>
                    )}
                    <ThemedText type="small" themeColor="textSecondary">
                      Review timing follows your own confidence, not a predicted grade.
                    </ThemedText>
                  </AppCard>
                </View>
              </View>
              <View style={styles.section}>
                <SectionHeader title="Your courses" detail="One place for every class" />
                <View style={[styles.courseGrid, columns && styles.row]}>
                  {data.courses.map((course) => (
                    <View key={course.id} style={{ flex: 1, minWidth: 220 }}>
                      <CourseCard course={course} />
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={{ fontSize: 29, lineHeight: 36, fontWeight: '600' }}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}
const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { fontSize: 20, fontWeight: '600' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 14, minWidth: 0 },
  demo: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12 },
  intro: { gap: 10 },
  title: { fontSize: 34, lineHeight: 42, letterSpacing: -1.2 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: 16, padding: 18, gap: 4 },
  columns: { gap: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { gap: 28, minWidth: 0, width: '100%' },
  section: { gap: 16 },
  focus: {
    backgroundColor: Brand.navy,
    padding: 28,
    borderRadius: 20,
    gap: 20,
    overflow: 'hidden',
  },
  focusTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  focusLabel: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  focusEyebrow: { color: Colors.dark.accent, fontSize: 11, letterSpacing: 1.3, fontWeight: '700' },
  focusTitle: {
    color: 'white',
    fontSize: 29,
    lineHeight: 37,
    letterSpacing: -0.6,
    fontWeight: '600',
  },
  focusDescription: { color: '#D0DCF2', fontSize: 15, lineHeight: 24 },
  focusButton: {
    backgroundColor: '#EDF2FF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minHeight: 48,
  },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62 },
  queueIndex: { fontSize: 13 },
  courseGrid: { gap: 16, flexWrap: 'wrap' },
});
