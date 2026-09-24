import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { AppIcon, type IconName } from './AppIcon';
import { usePressScale } from './usePressScale';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Web shows focus rings for keyboard focus only, not after a mouse click. */
function focusVisible(target: unknown) {
  if (Platform.OS !== 'web') return true;
  const element = target as { matches?: (selector: string) => boolean } | null;
  return element?.matches?.(':focus-visible') ?? true;
}

/** The workspace's single button: toolbar actions, dialog actions and empty-state actions. */
export function WorkspaceButton({
  label,
  onPress,
  icon,
  primary = false,
  disabled = false,
  busy = false,
  accessibilityLabel,
  accessibilityHint,
  expanded,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
  /** Keeps the button inert and announces work in progress; the label should say so. */
  busy?: boolean;
  /** Overrides the visible label when it lacks context, e.g. "Save" → "Save profile". */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** For buttons that open and close a region. */
  expanded?: boolean;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const inert = disabled || busy;
  const press = usePressScale(inert);
  const color = primary ? theme.accentText : theme.text;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inert, busy, expanded }}
        disabled={inert}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={(event) => setFocused(focusVisible(event.target))}
        onBlur={() => setFocused(false)}
        style={({ hovered, pressed }) => [
          styles.button,
          {
            // Full touch targets on phones; compact controls beside a pointer.
            minHeight: width < 600 ? 44 : 32,
            borderColor: focused ? theme.focus : primary ? theme.accent : theme.borderStrong,
            backgroundColor: primary
              ? theme.accent
              : hovered || pressed
                ? theme.backgroundHover
                : theme.backgroundElement,
          },
          focused && { outlineColor: theme.focus, outlineStyle: 'solid', outlineWidth: 2 },
          primary && (hovered || pressed) && !inert && { opacity: 0.88 },
          inert && { opacity: 0.6 },
        ]}
      >
        {icon ? <AppIcon name={icon} size={14} color={color} /> : null}
        <ThemedText style={[styles.buttonLabel, { color }]}>{label}</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Find a notebook…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.search,
        {
          minHeight: width < 600 ? 44 : 36,
          borderColor: focused ? theme.focus : theme.borderStrong,
          backgroundColor: theme.backgroundElement,
        },
      ]}
    >
      <AppIcon name="search" size={16} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel={placeholder.replace('…', '')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.searchInput, { color: theme.text }]}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChange('')}
          style={styles.clear}
        >
          <AppIcon name="close" size={14} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyPanel({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <AppIcon name="file" size={22} color={theme.textTertiary} />
      <View style={styles.emptyCopy}>
        <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
        <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      </View>
      {action && onAction ? <WorkspaceButton label={action} onPress={onAction} /> : null}
    </View>
  );
}

export function Notice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <AppIcon name="info" size={16} color={theme.danger} />
      <ThemedText accessibilityRole="alert" style={[styles.noticeText, { color: theme.textSecondary }]}>
        {message}
      </ThemedText>
      {onRetry ? <WorkspaceButton label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: 11, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 11, borderWidth: 1, borderRadius: Radius.medium, minWidth: 0 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 7, paddingRight: 10, fontSize: 13 },
  clear: { width: 38, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, gap: 14, alignItems: 'flex-start' },
  emptyCopy: { gap: 4 },
  emptyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  description: { fontSize: 13, lineHeight: 20, maxWidth: 400 },
  notice: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  noticeText: { flex: 1, minWidth: 140, fontSize: 13, lineHeight: 20 },
});
