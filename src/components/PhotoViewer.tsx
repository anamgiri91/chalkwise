import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { Radius } from '@/constants/theme';

export type ViewerPhoto = { id: string; url: string | null };

/**
 * Full-screen view of one original photo, opened from a note line or a thumbnail.
 * The dark backdrop is fixed rather than themed: photos of boards read best on black
 * in both light and dark mode.
 */
export function PhotoViewer({
  photos,
  index,
  context,
  onChange,
  onClose,
}: {
  photos: ViewerPhoto[];
  /** Zero-based photo to show, or null when closed. */
  index: number | null;
  /** The note line that opened the viewer, shown so the student knows what to look for. */
  context?: string;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const photo = index === null ? null : photos[index];
  const count = photos.length;
  const step = (delta: number) => {
    if (index !== null && count > 1) onChange((index + delta + count) % count);
  };
  return (
    <Modal
      visible={photo !== null && photo !== undefined}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.top}>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.title}>
              Original {index === null ? '' : index + 1} of {count}
            </ThemedText>
            {context ? (
              <ThemedText numberOfLines={2} style={styles.context}>
                Look for: {context}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <AppIcon name="close" size={18} color="#F2F4F7" />
          </Pressable>
        </View>
        {photo?.url ? (
          <Image
            source={{ uri: photo.url }}
            resizeMode="contain"
            accessibilityLabel={`Original photo ${(index ?? 0) + 1}`}
            style={{ width: width - 24, height: height * 0.7, alignSelf: 'center' }}
          />
        ) : (
          <View style={styles.missing}>
            <ThemedText style={styles.context}>
              This photo is temporarily unavailable. Close and refresh to try again.
            </ThemedText>
          </View>
        )}
        {count > 1 ? (
          <View style={styles.nav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              onPress={() => step(-1)}
              style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
            >
              <ThemedText style={styles.navLabel}>Previous</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              onPress={() => step(1)}
              style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
            >
              <ThemedText style={styles.navLabel}>Next</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#08090C', gap: 14 },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
  },
  titleBlock: { flex: 1, gap: 4 },
  title: { color: '#F2F4F7', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  context: { color: '#B8C0CC', fontSize: 13, lineHeight: 19 },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pressed: { opacity: 0.7 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  nav: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  navButton: {
    minWidth: 112,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  navLabel: { color: '#F2F4F7', fontSize: 14, fontWeight: '600' },
});
