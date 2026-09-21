import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  router,
  useRootNavigationState,
  useSegments,
} from 'expo-router';

import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/AppButton';
import { signOut } from '@/services/auth';

import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/hooks/use-theme';
import { getCurrentUserId, getMyProfile, onAuthChange, onProfileChange } from '@/services/auth';
import { hasEnrolledCourses, onEnrollmentChange } from '@/services/enrollment';

const authRoutes = ['login', 'signup', 'account-help'];

function useAuthGate() {
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [state, setState] = useState<{
    ready: boolean;
    userId: string | null;
    profile: boolean;
    enrollment: boolean;
    error: string | null;
  }>({ ready: false, userId: null, profile: false, enrollment: false, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let revision = 0;
    async function resolve(id: string | null) {
      const current = ++revision;
      try {
        const profile = id ? await getMyProfile() : null;
        const enrollment = profile ? await hasEnrolledCourses() : false;
        if (active && current === revision)
          setState({ ready: true, userId: id, profile: !!profile, enrollment, error: null });
      } catch (error) {
        if (active && current === revision)
          setState((value) => ({
            ...value,
            ready: true,
            error: error instanceof Error ? error.message : 'Could not open your workspace.',
          }));
      }
    }
    const refresh = () => {
      void getCurrentUserId()
        .then(resolve)
        .catch((error) => {
          if (active)
            setState((value) => ({
              ...value,
              ready: true,
              error: error instanceof Error ? error.message : 'Could not check your session.',
            }));
        });
    };
    refresh();
    const stopProfile = onProfileChange(refresh);
    const stopEnrollment = onEnrollmentChange(refresh);
    let stopAuth: (() => void) | undefined;
    void onAuthChange((id) => {
      void resolve(id);
    })
      .then((off) => {
        if (active) stopAuth = off;
        else off();
      })
      .catch(() => {});
    return () => {
      active = false;
      revision++;
      stopProfile();
      stopEnrollment();
      stopAuth?.();
    };
  }, [attempt]);

  useEffect(() => {
    if (!state.ready || state.error || !navigationState?.key) return;
    const section: string = segments[0] ?? '';
    const inAuth = authRoutes.includes(section);
    if (!state.userId) {
      if (!inAuth) router.replace('/login');
    } else if (!state.profile) {
      if (section !== 'onboarding') router.replace('/onboarding');
    } else if (!state.enrollment) {
      if (section !== 'course-onboarding') router.replace('/course-onboarding');
    } else if (inAuth || section === 'onboarding' || section === 'course-onboarding')
      router.replace('/');
  }, [state, segments, navigationState?.key]);

  return {
    ...state,
    retry: () => {
      setState((value) => ({ ...value, ready: false, error: null }));
      setAttempt((value) => value + 1);
    },
  };
}

export default function RootLayout() {
  const theme = useTheme();
  const gate = useAuthGate();
  const dark = theme.isDark;
  const navigationTheme = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navigationTheme,
        colors: {
          ...navigationTheme.colors,
          background: theme.background,
          card: theme.background,
          text: theme.text,
          primary: theme.text,
        },
      }}
    >
      <StatusBar style={dark ? 'light' : 'dark'} />

      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: theme.background,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontSize: 16,
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: theme.background,
          },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Chalkwise',
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="course-onboarding"
          options={{
            title: 'Choose courses',
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="courses"
          options={{
            title: 'Courses',
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="catchup"
          options={{
            title: 'CatchUp',
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="library"
          options={{
            title: 'CatchUp',
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="course/[id]"
          options={{
            title: 'Course workspace',
          }}
        />

        <Stack.Screen
          name="lecture/[id]"
          options={{
            title: 'Lecture notebook',
          }}
        />

        <Stack.Screen
          name="capture"
          options={{
            title: 'Capture lecture',
          }}
        />

        <Stack.Screen
          name="processing"
          options={{
            title: 'The clarity process',
          }}
        />
      </Stack>
      {!gate.ready || gate.error ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
            gap: 20,
            backgroundColor: theme.background,
          }}
        >
          {gate.error ? (
            <>
              <ThemedText type="subtitle">Your workspace is safe</ThemedText>
              <ThemedText accessibilityRole="alert">{gate.error}</ThemedText>
              <AppButton title="Try again" onPress={gate.retry} />
              <AppButton
                secondary
                title="Return to sign in"
                onPress={() => {
                  void signOut().catch(gate.retry);
                }}
              />
            </>
          ) : (
            <ActivityIndicator color={theme.text} accessibilityLabel="Opening Chalkwise" />
          )}
        </View>
      ) : null}
    </ThemeProvider>
  );
}
