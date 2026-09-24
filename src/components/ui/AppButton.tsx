import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from './usePressScale';
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
  const press = usePressScale(disabled);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed, hovered }) => [
          styles.button,
          { backgroundColor },
          secondary && { borderWidth: 1, borderColor: theme.borderStrong },
          secondary && (pressed || hovered) && { backgroundColor: theme.backgroundHover },
          !secondary && (pressed || hovered) && !disabled && styles.hover,
          disabled && styles.dim,
        ]}
      >
        <Text style={[styles.label, { color }]}>{title}</Text>
      </Pressable>
    </Animated.View>
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
  hover: { opacity: 0.88 },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
