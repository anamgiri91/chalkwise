/**
 * Colour data only: no React Native imports, so the contrast rules in
 * `tests/theme.test.ts` can load it directly under plain Node.
 *
 * One cool-grey ramp carries structure; colour is reserved for state and for
 * interactive affordances, never decoration. Every text pair meets WCAG AA
 * (4.5:1) and every interactive boundary meets 3:1 against the surfaces it sits
 * on. New values must be checked by that test rather than chosen by eye.
 */

export const Colors = {
  light: {
    text: '#14171C',
    background: '#FAFBFC',
    backgroundElement: '#FFFFFF',
    backgroundHover: '#F3F5F8',
    backgroundSelected: '#EAEEF3',
    textSecondary: '#5A6472',
    textTertiary: '#646E7F',
    border: '#E2E7ED',
    borderStrong: '#868FA0',
    accent: '#1B4DD1',
    accentText: '#FFFFFF',
    accentSurface: '#EDF2FE',
    focus: '#1B4DD1',
    danger: '#B42318',
    success: '#067647',
    successSurface: '#ECFDF3',
    warning: '#B54708',
    warningSurface: '#FEF6E7',
  },
  dark: {
    text: '#F2F4F7',
    background: '#0C0E12',
    backgroundElement: '#15181E',
    backgroundHover: '#1C2027',
    backgroundSelected: '#242932',
    textSecondary: '#98A2B2',
    textTertiary: '#8A94A6',
    border: '#242932',
    borderStrong: '#5E6572',
    accent: '#7CA0FF',
    accentText: '#0C0E12',
    accentSurface: '#16203A',
    focus: '#7CA0FF',
    danger: '#FF8A80',
    success: '#4ADE80',
    successSurface: '#0F2A1C',
    warning: '#FBBF24',
    warningSurface: '#2A2213',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
