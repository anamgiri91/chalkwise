import { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChalkwiseLogo } from '@/components/ChalkwiseLogo';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput, FormError } from '@/components/ui/AppTextInput';
import { Screen } from '@/components/ui/Screen';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { saveMyProfile } from '@/services/auth';
import { years, type Year } from '@/types';

export default function OnboardingScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [year, setYear] = useState<Year | null>(null);
  const [major, setMajor] = useState('');
  const majorRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = name.trim().length > 0 && year !== null && major.trim().length > 0;

  async function submit() {
    Keyboard.dismiss();
    if (!ready || busy || !year) return;
    setBusy(true);
    setError('');
    try {
      await saveMyProfile({ name, year, major });
      // The root layout moves on once the profile exists.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile.');
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
          Tell us who you are.
        </ThemedText>

        <ThemedText themeColor="textSecondary">
          Three quick things, so classmates can find you and Chalkwise fits your program.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <AppTextInput
          label="Full name"
          accessibilityLabel="Full name, required"
          value={name}
          onChangeText={setName}
          editable={!busy}
          placeholder="e.g. Alex Rivera"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => majorRef.current?.focus()}
        />

        <View style={styles.field}>
          <ThemedText nativeID="year-label" style={[styles.label, { color: theme.textSecondary }]}>
            Year
          </ThemedText>
          <View style={styles.chips} accessibilityRole="radiogroup" aria-labelledby="year-label">
            {years.map((option) => {
              const active = year === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityLabel={option}
                  accessibilityState={{ checked: active, disabled: busy }}
                  disabled={busy}
                  onPress={() => {
                    Keyboard.dismiss();
                    setYear(option);
                  }}
                  style={({ pressed, hovered }) => [
                    styles.chip,
                    {
                      backgroundColor: active
                        ? theme.accent
                        : hovered || pressed
                          ? theme.backgroundHover
                          : theme.backgroundElement,
                      borderColor: active ? theme.accent : theme.borderStrong,
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.chipText, { color: active ? theme.accentText : theme.text }]}
                  >
                    {option}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <AppTextInput
          ref={majorRef}
          label="Major or program"
          accessibilityLabel="Major or program, required"
          value={major}
          onChangeText={setMajor}
          editable={!busy}
          placeholder="e.g. Computer Science"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={submit}
        />
      </View>

      <FormError message={error} />

      <AppButton title="Enter Chalkwise" busy={busy} disabled={!ready} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intro: { gap: 12 },
  title: { fontFamily: Fonts.serif, fontWeight: '400', letterSpacing: -1.2 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
});
