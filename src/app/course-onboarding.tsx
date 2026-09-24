import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddCourseSheet } from '@/components/AddCourseSheet';
import { ChalkwiseLogo } from '@/components/ChalkwiseLogo';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { FormError } from '@/components/ui/AppTextInput';
import { EmptyState } from '@/components/ui/Editorial';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourses } from '@/services/courses';
import { enrollInCourse, getMyEnrolledCourses } from '@/services/enrollment';
import type { Course } from '@/types';

export default function CourseOnboardingScreen() {
  const theme = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getCourses(), getMyEnrolledCourses()])
      .then(([catalog, enrolled]) => {
        if (!active) return;
        setCourses(catalog);
        setSelected(new Set(enrolled.map((course) => course.id)));
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load courses.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function toggle(courseId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
    setError('');
  }

  async function submit() {
    if (!selected.size || saving) return;
    setSaving(true);
    setError('');
    try {
      await Promise.all([...selected].map(enrollInCourse));
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your courses.');
      setSaving(false);
    }
  }

  return (
    <>
      <Screen avoidKeyboard>
        <View style={styles.header}>
          <ChalkwiseLogo compact />
          <ThemedText type="smallBold" themeColor="textSecondary">
            Courses
          </ThemedText>
        </View>

        <View style={styles.intro}>
          <ThemedText type="title" style={styles.title}>
            Choose your courses.
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Pick at least one course. Chalkwise will use these choices for your notebooks and photo
            matching.
          </ThemedText>
        </View>

        {loading ? (
          <SkeletonList label="Opening the course catalog" rows={3} withHeading={false} />
        ) : courses.length ? (
          <View style={styles.list}>
            {courses.map((course) => {
              const active = selected.has(course.id);
              return (
                <Pressable
                  key={course.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${course.code}, ${course.name}`}
                  accessibilityState={{ checked: active, disabled: saving }}
                  disabled={saving}
                  onPress={() => toggle(course.id)}
                  style={({ pressed, hovered }) => [
                    styles.course,
                    {
                      backgroundColor: active
                        ? theme.accentSurface
                        : hovered || pressed
                          ? theme.backgroundHover
                          : theme.backgroundElement,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <View style={styles.courseCopy}>
                    <ThemedText style={[styles.code, { color: theme.accent }]}>
                      {course.code}
                    </ThemedText>
                    <ThemedText style={styles.name}>{course.name}</ThemedText>
                    {course.professor ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {course.professor}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.check,
                      active
                        ? { borderColor: theme.accent, backgroundColor: theme.accent }
                        : { borderColor: theme.borderStrong },
                    ]}
                  >
                    {active ? <AppIcon name="check" size={14} color={theme.accentText} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No courses yet"
            description="Create your course to start your Chalkwise workspace."
          />
        )}

        <FormError message={error} />

        <AppButton
          title="Enter Chalkwise"
          busy={saving}
          disabled={!selected.size}
          onPress={submit}
        />
        <AppButton
          secondary
          title="Create a missing course"
          disabled={saving}
          onPress={() => setAddOpen(true)}
        />
      </Screen>

      <AddCourseSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(course) => {
          setCourses((current) =>
            [course, ...current.filter((item) => item.id !== course.id)].sort(
              (a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id),
            ),
          );
          setSelected((current) => new Set(current).add(course.id));
          setError('');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intro: { gap: 12 },
  title: { fontFamily: Fonts.serif, fontWeight: '400', letterSpacing: -1.2 },
  list: { gap: 8 },
  course: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.large,
    borderWidth: 1,
  },
  courseCopy: { flex: 1, gap: 2 },
  code: { fontSize: 12.5, lineHeight: 18, fontWeight: '700', letterSpacing: 0.3 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  check: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 1.5,
  },
});
