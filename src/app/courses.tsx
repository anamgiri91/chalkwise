import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AddCourseSheet } from '@/components/AddCourseSheet';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { Row, RowGroup, Section, Toolbar } from '@/components/ui/DataRow';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Screen } from '@/components/ui/Screen';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourses } from '@/services/courses';
import { enrollInCourse, getMyEnrolledCourses, unenrollFromCourse } from '@/services/enrollment';
import type { Course } from '@/types';

export default function CoursesScreen() {
  const theme = useTheme();
  // Narrow rows stack the course details under the name instead of truncating it.
  const narrow = useWindowDimensions().width < 600;
  const [courses, setCourses] = useState<Course[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      Promise.all([getMyEnrolledCourses(), getCourses()])
        .then(([mine, all]) => {
          if (active) {
            setCourses(mine);
            setCatalog(all);
          }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not load courses.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );
  async function membership(course: Course, join: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (join) await enrollInCourse(course.id);
      else await unenrollFromCourse(course.id);
      setAttempt((x) => x + 1);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your courses.');
    } finally {
      setBusy(false);
    }
  }
  const available = catalog.filter((course) => !courses.some((mine) => mine.id === course.id));
  const open = (id: string) => router.push({ pathname: '/course/[id]', params: { id } });
  return (
    <>
      <Screen showBottomNav wide>
        <Toolbar
          title="Courses"
          actions={
            <>
              <WorkspaceButton
                label={browse ? 'Done' : 'Catalog'}
                accessibilityLabel={browse ? 'Close the course catalog' : 'Open the course catalog'}
                expanded={browse}
                onPress={() => setBrowse((value) => !value)}
              />
              <WorkspaceButton
                primary
                icon="plus"
                label="New course"
                accessibilityLabel="Create a course"
                onPress={() => setAdding(true)}
              />
            </>
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

        {browse ? (
          <Section label="Course catalog" count={available.length}>
            <RowGroup>
              {available.length ? (
                available.map((course, index) => (
                  <Row
                    key={course.id}
                    first={index === 0}
                    title={course.name}
                    meta={[course.code, course.professor]}
                    accessibilityHint={`Adds ${course.code} to your courses`}
                    onPress={() => void membership(course, true)}
                  />
                ))
              ) : (
                <Row
                  first
                  title="No other courses"
                  meta={['Create one instead']}
                  onPress={() => setAdding(true)}
                />
              )}
            </RowGroup>
          </Section>
        ) : null}

        <Section label="My courses" count={courses.length}>
          {loading && !courses.length ? (
            <SkeletonList label="Loading courses" rows={2} withHeading={false} />
          ) : (
            <RowGroup>
              {courses.length ? (
                courses.map((course, index) => (
                  <View
                    key={course.id}
                    style={[
                      styles.row,
                      index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${course.name}, ${course.code}`}
                      accessibilityHint="Opens this course"
                      onPress={() => open(course.id)}
                      style={({ pressed, hovered }) => [
                        styles.rowMain,
                        narrow && styles.rowStacked,
                        (pressed || hovered) && { backgroundColor: theme.backgroundHover },
                      ]}
                    >
                      <ThemedText numberOfLines={1} style={styles.rowTitle}>
                        {course.name}
                      </ThemedText>
                      <View style={[styles.rowMeta, narrow && styles.rowMetaStacked]}>
                        <ThemedText
                          numberOfLines={1}
                          style={[
                            styles.meta,
                            narrow && styles.metaStacked,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {course.code}
                        </ThemedText>
                        {course.professor ? (
                          <ThemedText
                            numberOfLines={1}
                            style={[
                              styles.meta,
                              narrow && styles.metaStacked,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {course.professor}
                          </ThemedText>
                        ) : null}
                        {narrow ? null : (
                          <AppIcon name="arrow" size={14} color={theme.textTertiary} />
                        )}
                      </View>
                    </Pressable>
                    {browse ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Leave ${course.code}`}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() => void membership(course, false)}
                        style={({ pressed, hovered }) => [
                          styles.leave,
                          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                          (pressed || hovered || busy) && styles.dim,
                        ]}
                      >
                        <ThemedText style={[styles.leaveLabel, { color: theme.danger }]}>
                          Leave
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              ) : (
                <Row
                  first
                  title="No courses yet"
                  meta={['Open the catalog to join one']}
                  onPress={() => setBrowse(true)}
                />
              )}
            </RowGroup>
          )}
        </Section>

        {browse ? (
          <ThemedText style={[styles.footnote, { color: theme.textTertiary }]}>
            Leaving a course removes it from your workspace. Saved notes are kept; rejoin to see
            them again.
          </ThemedText>
        ) : null}
      </Screen>
      <AddCourseSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={(course) => {
          void membership(course, true);
        }}
      />
    </>
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
  // Enrolled rows carry a second control, so the row is a container with two
  // sibling press targets: nesting one Pressable inside another fires both.
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  rowTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: '500', flexShrink: 1, flexGrow: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0 },
  meta: { fontSize: 12.5, lineHeight: 18, minWidth: 92, textAlign: 'right' },
  rowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  rowMetaStacked: { flexShrink: 1, maxWidth: '100%', gap: 10 },
  metaStacked: { minWidth: 0, flexShrink: 1, textAlign: 'left' },
  leave: {
    justifyContent: 'center',
    height: 26,
    paddingHorizontal: 10,
    marginRight: 10,
    borderWidth: 1,
    borderRadius: Radius.small,
  },
  leaveLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  footnote: { fontSize: 12, lineHeight: 16, marginTop: 4 },
});
