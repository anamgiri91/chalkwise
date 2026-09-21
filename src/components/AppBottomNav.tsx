import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { ThemedText } from './themed-text';
import { AppIcon, type IconName } from './ui/AppIcon';
import { useTheme } from '@/hooks/use-theme';
import { Radius, SidebarRailWidth, SidebarWidth } from '@/constants/theme';
import { setSidebarMode } from '@/features/navigation/sidebar';
import { workspaceSection } from '@/features/navigation/workspace';
import { getWorkspaceCapabilities } from '@/services/study';

const items = [
  { route: '/', section: 'overview', label: 'Overview', icon: 'grid' },
  { route: '/library', section: 'library', label: 'Notebooks', icon: 'file' },
  { route: '/courses', section: 'courses', label: 'Courses', icon: 'book' },
  { route: '/catchup', section: 'shared', label: 'Shared with me', icon: 'users' },
] as const;
const profile = { route: '/profile', section: 'profile', label: 'Account', icon: 'user' } as const;

function NavItem({
  item,
  vertical,
  active,
  rail = false,
}: {
  item: {
    route: '/' | '/library' | '/courses' | '/catchup' | '/profile';
    label: string;
    icon: IconName;
  };
  vertical: boolean;
  active: boolean;
  rail?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  // <Slot> accepts neither a function style nor an array, so hover state is tracked
  // here and the result is flattened; the function form was dropped silently, which
  // left every item with no active, hover or focus styling at all.
  return (
    <Link href={item.route} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={item.label}
        aria-current={active ? 'page' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        {...(rail ? { title: item.label } : null)}
        style={StyleSheet.flatten([
          styles.item,
          vertical ? (rail ? styles.railItem : styles.verticalItem) : styles.mobileItem,
          { borderColor: focused ? theme.focus : 'transparent' },
          active
            ? { backgroundColor: theme.backgroundSelected }
            : hovered && { backgroundColor: theme.backgroundHover },
        ])}
      >
        <AppIcon
          name={item.icon}
          size={vertical ? 17 : 20}
          color={active ? theme.text : theme.textSecondary}
        />
        {rail ? null : (
          <ThemedText
            style={[
              vertical ? styles.label : styles.mobileLabel,
              { color: active ? theme.text : theme.textSecondary },
              active && { fontWeight: '600' },
            ]}
          >
            {!vertical && item.label === 'Shared with me' ? 'Shared' : item.label}
          </ThemedText>
        )}
      </Pressable>
    </Link>
  );
}

export function AppBottomNav({
  vertical = false,
  rail = false,
}: {
  vertical?: boolean;
  rail?: boolean;
}) {
  const section = workspaceSection(usePathname());
  const theme = useTheme();
  const demo = getWorkspaceCapabilities().mode === 'mock';
  const renderItem = (item: (typeof items)[number]) => (
    <NavItem
      key={item.route}
      item={item}
      vertical={vertical}
      rail={rail}
      active={section === item.section}
    />
  );
  const capture = (
    <Link href={{ pathname: '/capture', params: { mode: 'photo', autoOpen: 'camera' } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="New capture"
        {...(rail ? { title: 'New capture' } : null)}
        // `Link asChild` renders through <Slot>, which accepts neither a function style
        // nor an array: the function form was dropped silently, leaving the button
        // transparent and collapsed to its icon. Flatten to a single object.
        style={StyleSheet.flatten([
          vertical ? (rail ? styles.railButton : styles.newCapture) : styles.capture,
          { backgroundColor: theme.accent },
        ])}
      >
        <AppIcon
          name={vertical ? 'plus' : 'camera'}
          size={vertical ? 16 : 20}
          color={theme.accentText}
        />
        {vertical && !rail ? (
          <ThemedText style={[styles.captureLabel, { color: theme.accentText }]}>
            New capture
          </ThemedText>
        ) : null}
      </Pressable>
    </Link>
  );
  if (!vertical)
    return (
      <View
        style={[
          styles.bottom,
          { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
        ]}
      >
        {items.slice(0, 2).map(renderItem)}
        {capture}
        {items.slice(2).map(renderItem)}
      </View>
    );
  return (
    <View
      style={[
        styles.sidebar,
        {
          width: rail ? SidebarRailWidth : SidebarWidth,
          paddingHorizontal: rail ? 8 : 12,
          backgroundColor: theme.background,
          borderRightColor: theme.border,
        },
      ]}
    >
      <Link href="/" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Chalkwise overview"
          style={styles.brand}
        >
          <View style={[styles.mark, { backgroundColor: theme.text }]}>
            <AppIcon name="book" color={theme.backgroundElement} size={17} />
          </View>
          {rail ? null : <ThemedText style={styles.brandName}>Chalkwise</ThemedText>}
        </Pressable>
      </Link>
      <View style={styles.captureContainer}>{capture}</View>
      {rail ? null : (
        <ThemedText style={[styles.sectionLabel, { color: theme.textTertiary }]}>
          Workspace
        </ThemedText>
      )}
      <View style={styles.verticalItems}>{items.map(renderItem)}</View>
      <View style={styles.spacer} />
      {demo && !rail ? (
        <View style={[styles.demo, { borderColor: theme.border }]}>
          <View style={styles.demoHead}>
            <AppIcon name="info" size={14} color={theme.textSecondary} />
            <ThemedText style={styles.demoLabel}>Demo workspace</ThemedText>
          </View>
          <ThemedText style={[styles.demoText, { color: theme.textSecondary }]}>
            Sample notebooks. Changes reset when you reload.
          </ThemedText>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rail ? 'Expand sidebar' : 'Collapse sidebar'}
        accessibilityState={{ expanded: !rail }}
        {...({ title: rail ? 'Expand sidebar' : 'Collapse sidebar' } as object)}
        onPress={() => setSidebarMode(rail ? 'expanded' : 'collapsed')}
        style={({ hovered, pressed }) => [
          styles.item,
          rail ? styles.railItem : styles.verticalItem,
          (hovered || pressed) && { backgroundColor: theme.backgroundHover },
        ]}
      >
        <View style={rail ? undefined : styles.flip}>
          <AppIcon name="chevron" size={16} color={theme.textSecondary} />
        </View>
        {rail ? null : (
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Collapse</ThemedText>
        )}
      </Pressable>
      <View style={[styles.account, { borderTopColor: theme.border }]}>
        <NavItem item={profile} vertical rail={rail} active={section === 'profile'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { paddingTop: 14, paddingBottom: 12, borderRightWidth: 1 },
  railItem: { flexDirection: 'row', justifyContent: 'center', height: 34, paddingHorizontal: 0 },
  railButton: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
  },
  flip: { transform: [{ rotate: '180deg' }] },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 9,
    minHeight: 40,
  },
  brandName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.4 },
  mark: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  captureContainer: { marginTop: 23, marginBottom: 22, paddingHorizontal: 4 },
  newCapture: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 36,
    borderRadius: Radius.medium,
  },
  captureLabel: { fontSize: 13, fontWeight: '500' },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '500',
    paddingHorizontal: 11,
    marginBottom: 7,
  },
  verticalItems: { gap: 3 },
  item: { alignItems: 'center', borderRadius: Radius.medium, borderWidth: 2 },
  verticalItem: { flexDirection: 'row', paddingHorizontal: 8, gap: 10, minHeight: 37 },
  mobileItem: { flex: 1, paddingVertical: 7, gap: 4, minHeight: 56, justifyContent: 'center' },
  label: { fontSize: 13, lineHeight: 20 },
  mobileLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500' },
  spacer: { flex: 1, minHeight: 28 },
  demo: {
    padding: 12,
    marginHorizontal: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: Radius.medium,
    gap: 6,
  },
  demoHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  demoLabel: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  demoText: { fontSize: 11, lineHeight: 17 },
  account: { borderTopWidth: 1, paddingTop: 10 },
  bottom: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  capture: {
    width: 44,
    height: 44,
    marginHorizontal: 6,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
