import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Labelled single choice from a short list, e.g. academic year. Exposed as a radio group. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.label, { color: theme.textSecondary }]}>{label}</ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={option}
              accessibilityState={{ checked: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(option)}
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
                disabled && styles.dim,
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
  );
}

const styles = StyleSheet.create({
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
  dim: { opacity: 0.6 },
});
