import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { PasswordField } from './PasswordField';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'secureTextEntry'> & {
  ref?: Ref<TextInput>;
  /** Visible label; also the accessible name unless `accessibilityLabel` is given. */
  label: string;
  /** Short guidance under the field, e.g. a password rule. */
  hint?: string;
  /** Renders a password field with a show/hide control. */
  password?: boolean;
};

/**
 * The app's labelled text field. Carries the shared input tokens (borderStrong for a
 * 3:1 boundary, focus colour on focus, 16px text so iOS does not zoom) so screens
 * stop redefining them.
 */
export function AppTextInput({
  ref,
  label,
  hint,
  password = false,
  accessibilityLabel,
  editable = true,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const style = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: focused ? theme.focus : theme.borderStrong,
    },
    !editable && { opacity: 0.6 },
  ];
  const shared = {
    ...props,
    ref,
    editable,
    accessibilityLabel: accessibilityLabel ?? label,
    accessibilityHint: props.accessibilityHint ?? hint,
    placeholderTextColor: theme.textTertiary,
    onFocus: (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setFocused(true);
      onFocus?.(event);
    },
    onBlur: (event: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setFocused(false);
      onBlur?.(event);
    },
  };
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.label, { color: theme.textSecondary }]}>{label}</ThemedText>
      {password ? (
        <PasswordField {...shared} style={style} />
      ) : (
        <TextInput {...shared} style={style} />
      )}
      {hint ? (
        <ThemedText style={[styles.hint, { color: theme.textTertiary }]}>{hint}</ThemedText>
      ) : null}
    </View>
  );
}

/** Inline form error, announced when it appears. */
export function FormError({ message }: { message: string }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <ThemedText
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.error, { color: theme.danger }]}
    >
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    lineHeight: 22,
  },
  hint: { fontSize: 12.5, lineHeight: 18 },
  error: { fontSize: 14, lineHeight: 21 },
});
