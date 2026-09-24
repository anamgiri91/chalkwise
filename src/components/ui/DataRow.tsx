import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from './AppIcon';
import { Radius, SidebarBreakpoint, SidebarWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Toolbar({
  title,
  actions,
  description,
}: {
  title: string;
  actions?: ReactNode;
  description?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toolbar}>
      <View style={styles.titleBlock}>
        <ThemedText accessibilityRole="header" style={styles.toolbarTitle}>
          {title}
        </ThemedText>
        {description ? (
          <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
            {description}
          </ThemedText>
        ) : null}
      </View>
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
}: PropsWithChildren<{
  label: string;
  count?: number;
  action?: string;
  onAction?: () => void;
}>) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText accessibilityRole="header" style={styles.sectionLabel}>
          {label}
        </ThemedText>
        {typeof count === 'number' ? (
          <ThemedText
            style={[
              styles.count,
              { color: theme.textSecondary, backgroundColor: theme.backgroundSelected },
            ]}
          >
            {count}
          </ThemedText>
        ) : null}
        <View style={styles.spacer} />
        {action && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ hovered, pressed }) => [
              styles.sectionAction,
              (hovered || pressed) && { backgroundColor: theme.backgroundHover },
            ]}
          >
            <ThemedText style={[styles.action, { color: theme.textSecondary }]}>
              {action}
            </ThemedText>
            <AppIcon name="chevron" size={12} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

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

/** Metadata uses columns when space allows, then moves below the full title. */
export function Row({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  first = false,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  meta?: (string | null | undefined)[];
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const available = measuredWidth ?? width - (width >= SidebarBreakpoint ? SidebarWidth : 0) - 64;
  const compact = available < 620;
  const parts = (meta ?? []).filter(Boolean) as string[];
  const metadata = parts.length ? (
    <View style={[styles.rowMeta, compact && styles.compactMeta]}>
      {parts.map((part, index) => (
        <ThemedText
          key={`${index}:${part}`}
          numberOfLines={compact ? undefined : 1}
          style={[styles.meta, compact && styles.compactMetaText, { color: theme.textSecondary }]}
        >
          {part}
        </ThemedText>
      ))}
    </View>
  ) : null;
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.rowCopy}>
        <ThemedText numberOfLines={compact ? undefined : 1} style={styles.rowTitle}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            numberOfLines={compact ? undefined : 1}
            style={[styles.rowSubtitle, { color: theme.textSecondary }]}
          >
            {subtitle}
          </ThemedText>
        ) : null}
        {compact ? metadata : null}
      </View>
      {!compact ? metadata : null}
      {onPress && !trailing ? (
        <AppIcon name="chevron" size={14} color={theme.textTertiary} />
      ) : null}
    </>
  );
  return (
    <View
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[
        styles.row,
        compact && trailing ? styles.stackedRow : null,
        !first && { borderTopWidth: 1, borderTopColor: theme.border },
      ]}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[title, subtitle, ...parts].filter(Boolean).join(', ')}
          accessibilityHint={accessibilityHint}
          onPress={onPress}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={({ hovered, pressed }) => [
            styles.rowMain,
            { borderColor: focused ? theme.focus : 'transparent' },
            (hovered || pressed || focused) && { backgroundColor: theme.backgroundHover },
          ]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={[styles.rowMain, { borderColor: 'transparent' }]}>{content}</View>
      )}
      {trailing ? (
        <View style={[styles.trailing, compact && styles.compactTrailing]}>{trailing}</View>
      ) : null}
    </View>
  );
}

export function ListHeader({ title = 'Notebook', columns }: { title?: string; columns: string[] }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View
      style={[
        styles.listHeader,
        { backgroundColor: theme.background, borderBottomColor: theme.border },
      ]}
    >
      <ThemedText style={[styles.columnLabel, styles.spacer, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
      {width >= 900 ? (
        <View style={styles.rowMeta}>
          {columns.map((label) => (
            <ThemedText
              key={label}
              style={[styles.meta, styles.columnLabel, { color: theme.textSecondary }]}
            >
              {label}
            </ThemedText>
          ))}
        </View>
      ) : null}
      <View style={{ width: 14 }} />
    </View>
  );
}

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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  titleBlock: { gap: 5, minWidth: 160, flexShrink: 1 },
  toolbarTitle: { fontSize: 22, lineHeight: 30, fontWeight: '600', letterSpacing: -0.5 },
  description: { fontSize: 13, lineHeight: 20 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  section: { gap: 10, minWidth: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  sectionLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  count: {
    fontSize: 11,
    lineHeight: 18,
    minWidth: 21,
    paddingHorizontal: 5,
    textAlign: 'center',
    borderRadius: Radius.small,
    fontVariant: ['tabular-nums'],
  },
  spacer: { flex: 1 },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: Radius.small,
  },
  action: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  group: { borderWidth: 1, borderRadius: Radius.large, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  stackedRow: { flexDirection: 'column', alignItems: 'stretch' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 2,
  },
  leading: { width: 24, alignItems: 'center', flexShrink: 0 },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  rowSubtitle: { fontSize: 12, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0 },
  // A minimum keeps short values in aligned columns; longer values grow instead of truncating.
  meta: { fontSize: 12, lineHeight: 18, minWidth: 104, maxWidth: 280, textAlign: 'right' },
  compactMeta: { flexWrap: 'wrap', flexShrink: 1, gap: 8, paddingTop: 1 },
  compactMetaText: { width: 'auto', flexShrink: 1, textAlign: 'left' },
  trailing: { paddingRight: 12, flexShrink: 0 },
  compactTrailing: { alignSelf: 'flex-end', paddingBottom: 10, paddingLeft: 14 },
  listHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 50,
    paddingRight: 14,
    borderBottomWidth: 1,
  },
  columnLabel: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
});
