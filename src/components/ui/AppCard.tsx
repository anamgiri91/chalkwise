import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';

export function AppCard({ children }: PropsWithChildren) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 24, borderRadius: 18, gap: 16, boxShadow: '0 2px 12px rgba(25, 36, 59, 0.04)' },
});
