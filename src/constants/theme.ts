/** Chalkwise paper-and-ink palette with native and web system font fallbacks. */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#19243B',
    background: '#F5F7FB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6EBF5',
    textSecondary: '#59677E',
  },
  dark: {
    text: '#EFF3FF',
    background: '#111827',
    backgroundElement: '#1C273A',
    backgroundSelected: '#2C3B54',
    textSecondary: '#B6C2D8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, sans-serif',
    serif: 'Georgia, serif',
    rounded: 'system-ui, sans-serif',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 760;

// Existing semantic aliases remain so capture and legacy components stay compatible.
export const Brand = {
  forest: '#3157D5',
  lime: '#DCE6FF',
  paper: '#F5F7FB',
  ink: '#19243B',
  muted: '#BDCFF7',
  accent: '#3157D5',
  navy: '#17294D',
  teal: '#247A70',
} as const;
