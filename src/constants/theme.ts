/**
 * Chalkwise workspace palette.
 *
 * One cool-grey ramp carries structure; colour is reserved for state and for
 * interactive affordances, never for decoration. Every text pair meets WCAG AA
 * (4.5:1) and every interactive boundary meets 3:1 against the surfaces it sits
 * on; `tests/theme.test.ts` enforces this, so new values must be checked rather
 * than chosen by eye.
 *
 * Token names are stable. Several screens still detect dark mode by comparing
 * `theme.background` with `Brand.paper`, so those two values must stay identical;
 * `useTheme().isDark` is the supported replacement for new code.
 */

import { Platform } from 'react-native';
import { Colors } from './palette';

export { Colors } from './palette';

export type { ThemeColor } from './palette';

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

/** Backdrop behind dialogs and sheets; neutral so it suits both schemes. */
export const Scrim = 'rgba(12, 14, 18, 0.55)';

/** Tighter than the previous rounded cards; a workspace reads as panels, not pills. */
export const Radius = { small: 4, medium: 6, large: 8, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 760;
/** Width at which the workspace switches from bottom navigation to a sidebar. */
export const SidebarBreakpoint = 900;
export const SidebarWidth = 224;
/** Collapsed icon rail, used below SidebarExpandedBreakpoint. */
export const SidebarRailWidth = 56;
/**
 * Below this the sidebar collapses to the rail so laptops keep their content width.
 * Chosen above the common Mac laptop widths (1280, 1440, 1512) so those default to
 * the rail; 16-inch and external displays have room for the full sidebar.
 */
export const SidebarExpandedBreakpoint = 1600;

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
