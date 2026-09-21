import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppIcon } from '@/components/ui/AppIcon';
import { Row, RowGroup, Section, Toolbar, since } from '@/components/ui/DataRow';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourse } from '@/services/courses';
import { getLectures } from '@/services/lectures';
import type { Course, Lecture } from '@/types';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [data, setData] = useState<{ course: Course | null; lectures: Lecture[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(false);
      Promise.all([getCourse(id), getLectures(id)])
        .then(([course, lectures]) => {
          if (active) setData({ course, lectures });
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
      <ThemedText style={[styles.primaryLabel, { color: theme.accentText }]}>Capture</ThemedText>
    </Pressable>
  );

  if (loading && !data) {
    return (
      <Screen showBottomNav wide>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Loading course" />
        </View>
      </Screen>
    );
  }

  if (error || !data?.course) {
    return (
      <Screen showBottomNav wide>
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
      <Toolbar title={course.name} actions={capture} />
      <ThemedText style={[styles.meta, { color: theme.textSecondary }]}>
        {[course.code, course.professor].filter(Boolean).join(' · ')}
      </ThemedText>

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
  meta: { fontSize: 12.5, lineHeight: 18, marginTop: -4 },
  centered: { paddingVertical: 48, alignItems: 'center' },
});
