import { Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { ThemedText } from './themed-text';
import { AppIcon, type IconName } from './ui/AppIcon';
import { useTheme } from '@/hooks/use-theme';
import { Radius, SidebarWidth } from '@/constants/theme';

const items: {
  route: '/' | '/courses' | '/catchup' | '/profile';
  label: string;
  icon: IconName;
}[] = [
  { route: '/', label: 'Overview', icon: 'home' },
  { route: '/courses', label: 'My courses', icon: 'book' },
  { route: '/catchup', label: 'CatchUp', icon: 'users' },
  { route: '/profile', label: 'Profile', icon: 'user' },
];

export function AppBottomNav({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname();
  const theme = useTheme();
  const capture = () =>
    router.push({ pathname: '/capture', params: { mode: 'photo', autoOpen: 'camera' } });

  const navItem = (item: (typeof items)[number]) => {
    const active = item.route === '/' ? pathname === '/' : pathname.startsWith(item.route);
    return (
      <Pressable
        key={item.route}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={() => router.replace(item.route)}
        style={({ pressed }) => [
          styles.item,
          vertical ? styles.verticalItem : styles.mobileItem,
          active && { backgroundColor: theme.backgroundSelected },
          pressed && { backgroundColor: theme.backgroundSelected, opacity: 0.8 },
        ]}
      >
        <AppIcon
          name={item.icon}
          size={vertical ? 17 : 20}
          color={active ? theme.text : theme.textSecondary}
        />
        <ThemedText
          style={[
            vertical ? styles.label : styles.mobileLabel,
            { color: active ? theme.text : theme.textSecondary },
            active && styles.activeLabel,
          ]}
        >
          {item.label}
        </ThemedText>
      </Pressable>
    );
  };

  if (!vertical) {
    return (
      <View
        style={[
          styles.bottom,
          { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
        ]}
      >
        {items.slice(0, 2).map(navItem)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture lecture"
          onPress={capture}
          style={({ pressed }) => [
            styles.capture,
            { backgroundColor: theme.accent },
            pressed && styles.dim,
          ]}
        >
          <AppIcon name="camera" color={theme.accentText} size={21} />
        </Pressable>
        {items.slice(2).map(navItem)}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.sidebar,
        { backgroundColor: theme.backgroundElement, borderRightColor: theme.border },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.accent }]}>
          <AppIcon name="camera" color={theme.accentText} size={15} />
        </View>
        <ThemedText style={styles.brandName}>Chalkwise</ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Capture lecture"
        onPress={capture}
        style={({ pressed }) => [
          styles.newCapture,
          { backgroundColor: theme.accent },
          pressed && styles.dim,
        ]}
      >
        <AppIcon name="plus" color={theme.accentText} size={16} />
        <ThemedText style={[styles.newCaptureLabel, { color: theme.accentText }]}>
          New capture
        </ThemedText>
      </Pressable>

      <ThemedText style={[styles.sectionLabel, { color: theme.textTertiary }]}>
        WORKSPACE
      </ThemedText>
      <View style={styles.verticalItems}>{items.map(navItem)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SidebarWidth,
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 16,
    borderRightWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8 },
  brandName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  mark: {
    width: 26,
    height: 26,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCapture: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 34,
    borderRadius: Radius.medium,
    marginTop: 20,
  },
  newCaptureLabel: { fontSize: 13, fontWeight: '600' },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginTop: 24,
    marginBottom: 6,
  },
  verticalItems: { gap: 1 },
  item: { alignItems: 'center', borderRadius: Radius.medium },
  verticalItem: { flexDirection: 'row', paddingHorizontal: 8, gap: 10, height: 32 },
  mobileItem: { flex: 1, paddingVertical: 6, gap: 3, minHeight: 52, justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '500' },
  activeLabel: { fontWeight: '600' },
  mobileLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500' },
  dim: { opacity: 0.75 },
  bottom: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  capture: {
    width: 44,
    height: 44,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
});
