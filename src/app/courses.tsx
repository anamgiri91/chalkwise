import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { CourseCard } from '@/components/CourseCard';
import { AddCourseSheet } from '@/components/AddCourseSheet';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/ui/Editorial';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/themed-text';
import { getMyEnrolledCourses, enrollInCourse, unenrollFromCourse } from '@/services/enrollment';
import { getCourses } from '@/services/courses';
import type { Course } from '@/types';

export default function CoursesScreen() {
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
  return (
    <>
      <Screen showBottomNav>
        <StatusBadge label="YOUR SEMESTER" />
        <ThemedText type="title">Room for every idea.</ThemedText>
        <ThemedText themeColor="textSecondary">
          One notebook for each class. Find the lectures, original material, and concepts you want
          to come back to.
        </ThemedText>
        <AppButton
          title={browse ? 'Close course catalog' : 'Add a course'}
          onPress={() => setBrowse((value) => !value)}
        />
        {error ? (
          <EmptyState
            title="Couldn't update your workspace"
            description={error}
            action="Try again"
            onPress={() => setAttempt((x) => x + 1)}
          />
        ) : null}
        {browse ? (
          <AppCard>
            <SectionHeader title="Course catalog" detail={`${available.length} available`} />
            {available.map((course) => (
              <View key={course.id} style={{ gap: 8, paddingVertical: 8 }}>
                <ThemedText type="smallBold">
                  {course.code} · {course.name}
                </ThemedText>
                <AppButton
                  secondary
                  title={`Join ${course.code}`}
                  disabled={busy}
                  onPress={() => membership(course, true)}
                />
              </View>
            ))}
            <AppButton title="Create a missing course" onPress={() => setAdding(true)} />
          </AppCard>
        ) : null}
        <SectionHeader title="My courses" detail={`${courses.length} enrolled`} />
        {loading ? (
          <EmptyState
            loading
            title="Opening your courses"
            description="Gathering your notebooks."
          />
        ) : courses.length ? (
          courses.map((course) => (
            <View key={course.id} style={{ gap: 8 }}>
              <CourseCard course={course} />
              {browse ? (
                <AppButton
                  secondary
                  disabled={busy}
                  title={`Leave ${course.code}`}
                  onPress={() => membership(course, false)}
                />
              ) : null}
            </View>
          ))
        ) : (
          <EmptyState
            title="Choose your first course"
            description="Open the catalog to join a course or create one."
            action="Browse courses"
            onPress={() => setBrowse(true)}
          />
        )}
        {browse ? (
          <ThemedText type="small" themeColor="textSecondary">
            Leaving a course removes it from your workspace. Saved notes are retained; rejoin to see
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
