import test from 'node:test';
import assert from 'node:assert/strict';
import { Colors } from '../src/constants/palette.ts';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const schemes = Object.entries(Colors) as [keyof typeof Colors, (typeof Colors)['light']][];

test('every colour is a six-digit hex value', () => {
  for (const [scheme, theme] of schemes) {
    for (const [token, value] of Object.entries(theme)) {
      assert.match(value, /^#[0-9A-F]{6}$/i, `${scheme}.${token} is not a hex colour`);
    }
  }
});

test('text meets WCAG AA (4.5:1) on every surface it is painted on', () => {
  for (const [scheme, t] of schemes) {
    for (const surface of [t.background, t.backgroundElement, t.backgroundHover] as const) {
      for (const token of ['text', 'textSecondary', 'textTertiary'] as const) {
        const value = contrast(t[token], surface);
        assert.ok(value >= 4.5, `${scheme}.${token} on ${surface} is ${value.toFixed(2)}:1`);
      }
    }
    // Secondary text also sits on the selected row in navigation and lists.
    assert.ok(contrast(t.textSecondary, t.backgroundSelected) >= 4.5, `${scheme} selected row`);
  }
});

test('state and accent colours stay readable where they are used', () => {
  for (const [scheme, t] of schemes) {
    for (const token of ['accent', 'danger', 'success', 'warning'] as const) {
      for (const surface of [t.background, t.backgroundElement] as const) {
        const value = contrast(t[token], surface);
        assert.ok(value >= 4.5, `${scheme}.${token} on ${surface} is ${value.toFixed(2)}:1`);
      }
    }
    assert.ok(contrast(t.accentText, t.accent) >= 4.5, `${scheme} accent label`);
    assert.ok(contrast(t.accent, t.accentSurface) >= 4.5, `${scheme} accent on its own tint`);
    assert.ok(contrast(t.warning, t.warningSurface) >= 4.5, `${scheme} warning on its own tint`);
    assert.ok(contrast(t.success, t.successSurface) >= 4.5, `${scheme} success on its own tint`);
    assert.ok(contrast(t.text, t.successSurface) >= 4.5, `${scheme} body text in a success`);
    assert.ok(contrast(t.text, t.warningSurface) >= 4.5, `${scheme} body text in a warning`);
  }
});

test('interactive boundaries meet the 3:1 non-text contrast minimum', () => {
  for (const [scheme, t] of schemes) {
    for (const surface of [t.background, t.backgroundElement] as const) {
      for (const token of ['borderStrong', 'focus'] as const) {
        const value = contrast(t[token], surface);
        assert.ok(value >= 3, `${scheme}.${token} on ${surface} is ${value.toFixed(2)}:1`);
      }
    }
  }
});

test('dark-mode detection by background comparison cannot silently invert', () => {
  // Seven screens still branch on `theme.background !== Brand.paper`.
  assert.notEqual(Colors.light.background, Colors.dark.background);
  assert.notEqual(Colors.light.text, Colors.dark.text);
});
