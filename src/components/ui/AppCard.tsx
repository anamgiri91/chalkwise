import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A panel, not a pill: a hairline border reads more precisely than a soft shadow. */
export function AppCard({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: Radius.large, gap: 14, borderWidth: 1 },
});
