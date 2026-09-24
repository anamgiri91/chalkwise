import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput, FormError } from '@/components/ui/AppTextInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import {
  confirmEmail,
  resendConfirmationCode,
  requestPasswordReset,
  resetPassword,
} from '@/services/auth';

export default function AccountHelp() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'confirm' | 'reset'>('reset');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!sent) {
        if (mode === 'confirm') await resendConfirmationCode(email);
        else await requestPasswordReset(email);
        setSent(true);
      } else {
        if (mode === 'confirm') await confirmEmail(email, code);
        else await resetPassword(email, code, password);
        router.replace('/login');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen avoidKeyboard>
      <ThemedText type="title" style={styles.title}>
        Get back to learning.
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Confirm your email or reset your password using an emailed code.
      </ThemedText>
      {!sent ? (
        <SegmentedControl
          accessibilityLabel="What do you need help with?"
          options={[
            { value: 'reset', label: 'Reset password' },
            { value: 'confirm', label: 'Confirm email' },
          ]}
          value={mode}
          onChange={setMode}
          disabled={busy}
        />
      ) : null}
      <AppTextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        editable={!busy && !sent}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@university.edu"
      />
      {sent ? (
        <>
          <ThemedText accessibilityLiveRegion="polite">
            Check your email for a verification code.
          </ThemedText>
          <AppTextInput
            label="Verification code"
            value={code}
            onChangeText={setCode}
            editable={!busy}
            textContentType="oneTimeCode"
            keyboardType="number-pad"
            placeholder="6-digit code"
          />
          {mode === 'reset' ? (
            <AppTextInput
              password
              label="New password"
              hint="At least 12 characters."
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              textContentType="newPassword"
              placeholder="Create a password"
            />
          ) : null}
        </>
      ) : null}
      <FormError message={error} />
      <AppButton
        title={sent ? 'Verify and continue' : 'Send code'}
        busy={busy}
        disabled={
          !email.trim() || (sent && (!code.trim() || (mode === 'reset' && password.length < 12)))
        }
        onPress={submit}
      />
      {sent ? (
        <AppButton
          secondary
          title="Change email or send another code"
          disabled={busy}
          onPress={() => setSent(false)}
        />
      ) : null}
      <AppButton secondary title="Back to sign in" onPress={() => router.replace('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: Fonts.serif, fontWeight: '400', letterSpacing: -1.2 },
});
