import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Mutually exclusive choice between a few modes, exposed as a radio group. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ hovered }) => [
              styles.segment,
              selected && {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.borderStrong,
              },
              !selected && hovered && { backgroundColor: theme.backgroundHover },
              disabled && styles.dim,
            ]}
          >
            <ThemedText
              style={[styles.label, { color: selected ? theme.text : theme.textSecondary }]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderRadius: Radius.large,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  dim: { opacity: 0.6 },
});
