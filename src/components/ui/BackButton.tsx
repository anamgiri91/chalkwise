import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from './AppIcon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** In-page back control for screens that hide the stack header inside the workspace shell. */
export function BackButton() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      // 26px visual height; the slop brings the touch area to 44px.
      hitSlop={9}
      style={({ pressed, hovered }) => [
        styles.back,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        (pressed || hovered) && { backgroundColor: theme.backgroundHover },
      ]}
    >
      <View style={styles.flip}>
        <AppIcon name="arrow" size={13} color={theme.textSecondary} />
      </View>
      <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Back</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 26,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  label: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  flip: { transform: [{ scaleX: -1 }] },
});
