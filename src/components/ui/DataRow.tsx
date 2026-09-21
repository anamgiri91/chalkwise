import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from './AppIcon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Workspace list primitives.
 *
 * A study workspace is a list of the student's own objects, so the default unit is
 * a dense row inside one bordered group, not a card per item. Rows are 44px with
 * 13px type: enough to scan a semester without scrolling, which a page of cards
 * cannot do.
 */

export function Toolbar({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <View style={styles.toolbar}>
      <ThemedText accessibilityRole="header" style={styles.toolbarTitle}>
        {title}
      </ThemedText>
      {actions ? <View style={styles.toolbarActions}>{actions}</View> : null}
    </View>
  );
}

export function Section({
  label,
  count,
  action,
  onAction,
  children,
}: PropsWithChildren<{ label: string; count?: number; action?: string; onAction?: () => void }>) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText accessibilityRole="header" style={styles.sectionLabel}>
          {label}
        </ThemedText>
        {typeof count === 'number' ? (
          <ThemedText style={[styles.count, { color: theme.textSecondary }]}>{count}</ThemedText>
        ) : null}
        <View style={styles.spacer} />
        {action && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={6}>
            {({ pressed }) => (
              <ThemedText
                style={[styles.action, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}
              >
                {action}
              </ThemedText>
            )}
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** One bordered container; rows inside are separated by hairlines, not gaps. */
export function RowGroup({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.group,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  title,
  meta,
  trailing,
  onPress,
  first = false,
  accessibilityHint,
}: {
  title: string;
  meta?: (string | null | undefined)[];
  trailing?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const parts = (meta ?? []).filter(Boolean) as string[];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress ? `${title}${parts.length ? `, ${parts.join(', ')}` : ''}` : undefined
      }
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }) => [
        styles.row,
        !first && { borderTopWidth: 1, borderTopColor: theme.border },
        (pressed || hovered) && onPress ? { backgroundColor: theme.backgroundHover } : null,
      ]}
    >
      <ThemedText numberOfLines={1} style={styles.rowTitle}>
        {title}
      </ThemedText>
      <View style={styles.rowMeta}>
        {parts.map((part) => (
          <ThemedText
            key={part}
            numberOfLines={1}
            style={[styles.meta, { color: theme.textSecondary }]}
          >
            {part}
          </ThemedText>
        ))}
        {trailing}
        {onPress ? <AppIcon name="arrow" size={14} color={theme.textTertiary} /> : null}
      </View>
    </Pressable>
  );
}

/** Compact age label: lists need "3d", not "September 11, 2026". */
export function since(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return fallback;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34, flexWrap: 'wrap' },
  toolbarTitle: { fontSize: 19, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 22 },
  sectionLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  count: { fontSize: 12.5, lineHeight: 18, fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
  action: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  group: { borderWidth: 1, borderRadius: Radius.large, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  rowTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: '500', flexShrink: 1, flexGrow: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0 },
  // Fixed width + right alignment turns repeated metadata into scannable columns.
  meta: { fontSize: 12.5, lineHeight: 18, minWidth: 92, textAlign: 'right' },
});
