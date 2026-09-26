import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppIcon } from '@/components/ui/AppIcon';
import { BackButton } from '@/components/ui/BackButton';
import { Row, RowGroup, Section, Toolbar, since } from '@/components/ui/DataRow';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { Skeleton, SkeletonList } from '@/components/ui/Skeleton';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourse } from '@/services/courses';
import { getLectures } from '@/services/lectures';
import { getMeetings, scheduleAvailable, setCourseMeetings } from '@/services/schedule';
import { ClassTimesEditor } from '@/components/ClassTimesEditor';
import { describeMeetings, groupMeetings } from '@/features/courses/schedule';
import type { Course, CourseMeeting, Lecture } from '@/types';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [data, setData] = useState<{ course: Course | null; lectures: Lecture[] } | null>(null);
  const [meetings, setMeetings] = useState<CourseMeeting[]>([]);
  const [editingTimes, setEditingTimes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(false);
      setEditingTimes(false);
      Promise.all([getCourse(id), getLectures(id), getMeetings().catch(() => [])])
        .then(([course, lectures, all]) => {
          if (!active) return;
          setData({ course, lectures });
          setMeetings(all.filter((meeting) => meeting.courseId === id));
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // Retry intentionally creates a new focused request even when the route is unchanged.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, attempt]),
  );

  const capture = (
    <WorkspaceButton
      primary
      icon="plus"
      label="Capture"
      accessibilityLabel="Capture class material"
      onPress={() => router.push('/capture')}
    />
  );

  if (loading && !data) {
    return (
      <Screen showBottomNav wide>
        <BackButton />
        <View style={styles.skeletonTitle}>
          <Skeleton width={220} height={22} />
          <Skeleton width={160} height={11} />
        </View>
        <SkeletonList label="Loading course" rows={2} />
      </Screen>
    );
  }

  if (error || !data?.course) {
    return (
      <Screen showBottomNav wide>
        <BackButton />
        <Toolbar title={error ? 'Could not load course' : 'Course not found'} />
        <RowGroup>
          <Row
            first
            title={error ? 'Try again' : 'Back to overview'}
            meta={[error ? 'The course did not load' : 'It may have moved']}
            onPress={error ? () => setAttempt((value) => value + 1) : () => router.replace('/')}
          />
        </RowGroup>
      </Screen>
    );
  }

  const course = data.course;
  return (
    <Screen showBottomNav wide>
      <BackButton />
      <Toolbar title={course.name} actions={capture} />
      <ThemedText style={[styles.meta, { color: theme.textSecondary }]}>
        {[course.code, course.professor].filter(Boolean).join(' · ')}
      </ThemedText>

      {scheduleAvailable() ? (
        <Section
          label="Class times"
          action={editingTimes ? undefined : meetings.length ? 'Edit' : undefined}
          onAction={() => setEditingTimes(true)}
        >
          {editingTimes ? (
            <ClassTimesEditor
              initial={groupMeetings(meetings)}
              onCancel={() => setEditingTimes(false)}
              onSave={async (next) => {
                setMeetings(await setCourseMeetings(id, next));
                setEditingTimes(false);
              }}
            />
          ) : (
            <RowGroup>
              {meetings.length ? (
                describeMeetings(meetings).map((line, index) => (
                  <Row
                    key={line}
                    first={index === 0}
                    title={line}
                    leading={<AppIcon name="clock" size={15} color={theme.textSecondary} />}
                  />
                ))
              ) : (
                <Row
                  first
                  title="Add when this class meets"
                  meta={['Photos taken in class file here automatically']}
                  leading={<AppIcon name="clock" size={15} color={theme.accent} />}
                  onPress={() => setEditingTimes(true)}
                />
              )}
            </RowGroup>
          )}
        </Section>
      ) : null}

      <Section label="Notebooks" count={data.lectures.length}>
        <RowGroup>
          {data.lectures.length ? (
            data.lectures.map((lecture, index) => (
              <Row
                key={lecture.id}
                first={index === 0}
                title={lecture.title}
                meta={[since(lecture.createdAt)]}
                onPress={() =>
                  router.push({ pathname: '/lecture/[id]', params: { id: lecture.id } })
                }
              />
            ))
          ) : (
            <Row
              first
              title="No notebooks in this course"
              meta={['Capture a board or a page to start']}
              onPress={() => router.push('/capture')}
            />
          )}
        </RowGroup>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletonTitle: { gap: 10, marginBottom: 12 },
  meta: { fontSize: 12.5, lineHeight: 18, marginTop: -4 },
});
