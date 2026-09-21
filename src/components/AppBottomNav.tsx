import { Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { ThemedText } from './themed-text';
import { AppIcon, type IconName } from './ui/AppIcon';
import { useTheme } from '@/hooks/use-theme';
import { Brand } from '@/constants/theme';

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
          pressed && { opacity: 0.6 },
        ]}
      >
        <AppIcon name={item.icon} color={active ? theme.text : theme.textSecondary} />
        <ThemedText
          style={[
            styles.label,
            !vertical && styles.mobileLabel,
            { color: active ? theme.text : theme.textSecondary },
          ]}
        >
          {item.label}
        </ThemedText>
      </Pressable>
    );
  };
  return (
    <View
      style={[
        vertical ? styles.sidebar : styles.bottom,
        { backgroundColor: theme.backgroundElement },
      ]}
    >
      {vertical ? (
        <>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <AppIcon name="camera" color="white" size={22} />
            </View>
            <ThemedText style={styles.brandName}>ClassLens</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 28 }}>
            Your learning workspace
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture lecture"
            onPress={capture}
            style={({ pressed }) => [styles.newCapture, { opacity: pressed ? 0.7 : 1 }]}
          >
            <AppIcon name="plus" color="white" size={20} />
            <ThemedText style={{ color: 'white', fontWeight: '600' }}>New capture</ThemedText>
          </Pressable>
          <View style={styles.verticalItems}>{items.map(navItem)}</View>
          <View style={styles.sidebarNote}>
            <AppIcon name="spark" color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              A little review today.{'\n'}A clearer idea tomorrow.
            </ThemedText>
          </View>
        </>
      ) : (
        <>
          {items.slice(0, 2).map(navItem)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture lecture"
            onPress={capture}
            style={styles.capture}
          >
            <AppIcon name="camera" color="white" size={23} />
          </Pressable>
          {items.slice(2).map(navItem)}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  sidebar: {
    width: 230,
    padding: 24,
    paddingTop: 32,
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: 'rgba(100,120,150,0.12)',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  brandName: { fontSize: 23, fontWeight: '700', letterSpacing: -0.8 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCapture: {
    backgroundColor: Brand.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 13,
    borderRadius: 12,
    marginBottom: 28,
    minHeight: 48,
  },
  verticalItems: { gap: 8 },
  item: { alignItems: 'center', borderRadius: 10 },
  verticalItem: { flexDirection: 'row', padding: 12, gap: 12, minHeight: 48 },
  mobileItem: { flex: 1, paddingVertical: 8, gap: 4, minHeight: 54 },
  label: { fontSize: 14, fontWeight: '600' },
  mobileLabel: { fontSize: 10, lineHeight: 16 },
  sidebarNote: { marginTop: 'auto', paddingTop: 40, gap: 12 },
  bottom: {
    flexDirection: 'row',
    gap: 2,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,120,150,0.12)',
    alignItems: 'center',
  },
  capture: {
    backgroundColor: Brand.accent,
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
});
