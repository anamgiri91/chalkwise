/**
 * Chalkwise neutral workspace palette.
 *
 * Hierarchy comes from weight, size and spacing rather than colour: surfaces are
 * near-neutral greys, and the accent is a near-black (near-white in dark mode) so
 * that colour is reserved for state rather than decoration.
 *
 * Token names are stable. Several screens still detect dark mode by comparing
 * `theme.background` with `Brand.paper`, so those two values must stay identical;
 * `useTheme().isDark` is the supported replacement for new code.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#18181B',
    background: '#FAFAFA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F1F1F3',
    textSecondary: '#6B6B76',
    textTertiary: '#9A9AA4',
    border: '#E5E5E8',
    borderStrong: '#D2D2D8',
    accent: '#18181B',
    accentText: '#FFFFFF',
    focus: '#3B82F6',
    danger: '#B42318',
  },
  dark: {
    text: '#F4F4F5',
    background: '#0B0B0D',
    backgroundElement: '#161619',
    backgroundSelected: '#232327',
    textSecondary: '#A0A0AB',
    textTertiary: '#71717A',
    border: '#26262B',
    borderStrong: '#35353C',
    accent: '#F4F4F5',
    accentText: '#18181B',
    focus: '#60A5FA',
    danger: '#F97066',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    rounded: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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

/** Tighter than the previous rounded cards; a workspace reads as panels, not pills. */
export const Radius = { small: 6, medium: 8, large: 12, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 760;
/** Width at which the workspace switches from bottom navigation to a sidebar. */
export const SidebarBreakpoint = 900;
export const SidebarWidth = 236;

// Semantic aliases retained for screens not yet migrated to the token set.
// `paper` and `ink` MUST mirror Colors.light or dark-mode detection inverts.
export const Brand = {
  /** Accent on light surfaces; also used as an icon and emphasis colour. */
  forest: Colors.light.accent,
  /** Accent on dark surfaces; used as text over dark backgrounds. */
  lime: Colors.dark.accent,
  paper: Colors.light.background,
  ink: Colors.light.text,
  muted: Colors.light.borderStrong,
  accent: Colors.light.accent,
  navy: '#27272A',
  teal: '#3F7D6E',
} as const;
