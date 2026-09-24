import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ChalkwiseLogo } from '@/components/ChalkwiseLogo';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput, FormError } from '@/components/ui/AppTextInput';
import { Screen } from '@/components/ui/Screen';
import { Fonts } from '@/constants/theme';
import { signIn, supportsEmailCode } from '@/services/auth';
import { AppButton } from '@/components/ui/AppButton';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = email.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      // The root layout redirects once the session lands.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <ChalkwiseLogo compact />
      </View>

      <View style={styles.intro}>
        <ThemedText type="title" style={styles.title}>
          Welcome back.
        </ThemedText>

        <ThemedText themeColor="textSecondary">
          Sign in to reach your notebooks, courses and classmates.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <AppTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          placeholder="you@university.edu"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AppTextInput
          ref={passwordRef}
          password
          label="Password"
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          placeholder="Your password"
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={submit}
        />
      </View>

      <FormError message={error} />

      <AppButton title="Sign in" busy={busy} disabled={!ready} onPress={submit} />
      <AppButton
        secondary
        title="Create an account"
        disabled={busy}
        onPress={() => router.replace('/signup')}
      />

      {supportsEmailCode() ? (
        <AppButton
          secondary
          title="Password or confirmation help"
          onPress={() => router.push('/account-help')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intro: { gap: 12 },
  title: { fontFamily: Fonts.serif, fontWeight: '400', letterSpacing: -1.2 },
  form: { gap: 16 },
});
