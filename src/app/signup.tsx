import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ChalkwiseLogo } from '@/components/ChalkwiseLogo';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput, FormError } from '@/components/ui/AppTextInput';
import { Screen } from '@/components/ui/Screen';
import { Fonts } from '@/constants/theme';
import { signUp, supportsEmailCode, confirmEmail, resendConfirmationCode } from '@/services/auth';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');

  async function confirm() {
    if (!confirmationEmail || busy) return;
    setBusy(true);
    setError('');
    try {
      await confirmEmail(confirmationEmail, code);
      router.replace('/login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not confirm your email.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!confirmationEmail || busy) return;
    setBusy(true);
    setError('');
    try {
      await resendConfirmationCode(confirmationEmail);
      setConfirmationMessage('A new code is on its way.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  }

  const ready = email.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await signUp(email, password);
      if (result.requiresEmailConfirmation) {
        setConfirmationEmail(email.trim());
      }
      // With an active session, the root layout handles navigation.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  if (confirmationEmail !== null) {
    return (
      <Screen>
        <View style={styles.header}>
          <ChalkwiseLogo compact />
        </View>

        <View style={styles.intro}>
          <ThemedText
            type="title"
            style={styles.title}
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
          >
            Check your email
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            {supportsEmailCode()
              ? `Enter the confirmation code sent to ${confirmationEmail}.`
              : `Open the confirmation link sent to ${confirmationEmail}, then sign in.`}
          </ThemedText>
        </View>

        {supportsEmailCode() ? (
          <>
            <AppTextInput
              label="Confirmation code"
              accessibilityLabel="Email confirmation code"
              value={code}
              onChangeText={setCode}
              editable={!busy}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="6-digit code"
            />
            <AppButton
              title="Confirm email"
              busy={busy}
              disabled={!code.trim()}
              onPress={confirm}
            />
            <AppButton secondary title="Send another code" disabled={busy} onPress={resend} />
          </>
        ) : null}
        <FormError message={error} />
        {confirmationMessage ? (
          <ThemedText accessibilityLiveRegion="polite">{confirmationMessage}</ThemedText>
        ) : null}
        <AppButton title="Go to sign in" secondary onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen avoidKeyboard>
      <View style={styles.header}>
        <ChalkwiseLogo compact />
      </View>

      <View style={styles.intro}>
        <ThemedText type="title" style={styles.title}>
          Start with Chalkwise.
        </ThemedText>

        <ThemedText themeColor="textSecondary">
          Create an account to keep your notebooks and connect with classmates.
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
          hint={supportsEmailCode() ? 'At least 12 characters.' : 'At least 6 characters.'}
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          placeholder="Create a password"
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={submit}
        />
      </View>

      <FormError message={error} />

      <AppButton title="Create account" busy={busy} disabled={!ready} onPress={submit} />
      <AppButton
        secondary
        title="I already have an account"
        disabled={busy}
        onPress={() => router.replace('/login')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intro: { gap: 12 },
  title: { fontFamily: Fonts.serif, fontWeight: '400', letterSpacing: -1.2 },
  form: { gap: 16 },
});
