import { Pressable, StyleSheet, Text } from 'react-native';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  accessibilityHint?: string;
}

export function AppButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
  accessibilityHint,
}: Props) {
  const theme = useTheme();
  // Accent inverts between schemes, so the token carries the decision.
  const backgroundColor = secondary ? theme.backgroundElement : theme.accent;
  const color = secondary ? theme.text : theme.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        secondary && { borderWidth: 1, borderColor: theme.border },
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={[styles.label, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: Radius.medium,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dim: { opacity: 0.6 },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
