import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon, type IconName } from './AppIcon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function WorkspaceButton({
  label,
  onPress,
  icon,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const color = primary ? theme.accentText : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ hovered, pressed }) => [
        styles.button,
        {
          minHeight: width < 600 ? 44 : 34,
          borderColor: focused ? theme.focus : primary ? theme.accent : theme.borderStrong,
          backgroundColor: primary
            ? theme.accent
            : hovered || pressed
              ? theme.backgroundHover
              : theme.backgroundElement,
        },
        focused && { outlineColor: theme.focus, outlineStyle: 'solid', outlineWidth: 2 },
        (disabled || (primary && pressed)) && { opacity: 0.6 },
      ]}
    >
      {icon ? <AppIcon name={icon} size={15} color={color} /> : null}
      <ThemedText style={[styles.buttonLabel, { color }]}>{label}</ThemedText>
    </Pressable>
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
  button: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  buttonLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
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
