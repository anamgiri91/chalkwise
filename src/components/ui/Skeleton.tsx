import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Shared pulse so every placeholder on a screen breathes in step. */
function usePulse() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(
      withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/** A single placeholder bar. Decorative: the surrounding container announces loading. */
export function Skeleton({
  width = '100%',
  height = 12,
  radius = Radius.small,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected }}
    />
  );
}

const titleWidths: DimensionValue[] = ['46%', '34%', '52%', '40%'];

/**
 * Placeholder shaped like `Section` + `RowGroup`, so content replaces it without a
 * layout jump. `label` names what is loading for screen readers.
 */
export function SkeletonList({
  label,
  rows = 3,
  withHeading = true,
}: {
  label: string;
  rows?: number;
  withHeading?: boolean;
}) {
  const theme = useTheme();
  const pulse = usePulse();
  return (
    <Animated.View
      accessible={Boolean(label)}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'auto' : 'no-hide-descendants'}
      accessibilityRole="progressbar"
      accessibilityLabel={label || undefined}
      style={[styles.section, pulse]}
    >
      {withHeading ? <Skeleton width={112} height={12} /> : null}
      <View
        style={[
          styles.group,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
      >
        {Array.from({ length: rows }, (_, index) => (
          <View
            key={index}
            style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
          >
            <Skeleton width={titleWidths[index % titleWidths.length]} height={12} />
            <View style={styles.meta}>
              <Skeleton width={64} height={10} />
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

/** Several stacked lists, for screens whose first paint shows multiple sections. */
export function SkeletonPage({ label, sections = 2 }: { label: string; sections?: number }) {
  return (
    <View style={styles.page}>
      {Array.from({ length: sections }, (_, index) => (
        <SkeletonList key={index} label={index === 0 ? label : ''} rows={index === 0 ? 3 : 2} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 28 },
  section: { gap: 14 },
  group: { borderWidth: 1, borderRadius: Radius.large, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 14,
    gap: 12,
  },
  meta: { flex: 1, alignItems: 'flex-end' },
});
