import { useHeaderHeight } from 'expo-router/react-navigation';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBottomNav } from '@/components/AppBottomNav';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = PropsWithChildren<{
  footer?: ReactNode;
  avoidKeyboard?: boolean;
  showBottomNav?: boolean;
  headerAbove?: boolean;
  wide?: boolean;
}>;
export function Screen({
  children,
  footer,
  avoidKeyboard = false,
  showBottomNav = false,
  headerAbove = false,
  wide = false,
}: Props) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const sidebar = showBottomNav && width >= 1000;
  const content = (
    <SafeAreaView
      edges={headerAbove ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <View style={styles.body}>
        {sidebar ? <AppBottomNav vertical /> : null}
        <View style={styles.main}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              {
                maxWidth: wide ? 1240 : MaxContentWidth,
                paddingHorizontal: width < 500 ? 20 : 32,
                paddingTop: width < 500 ? 20 : 32,
              },
            ]}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { maxWidth: wide ? 1240 : MaxContentWidth }]}>
              {footer}
            </View>
          ) : null}
          {showBottomNav && !sidebar ? <AppBottomNav /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
  return avoidKeyboard ? (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  content: { paddingBottom: 40, gap: 24, width: '100%', alignSelf: 'center', flexGrow: 1 },
  footer: { paddingHorizontal: 24, paddingVertical: 12, width: '100%', alignSelf: 'center' },
});
