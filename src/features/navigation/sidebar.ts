import { useSyncExternalStore } from 'react';

/**
 * Sidebar width preference.
 *
 * `auto` keeps the full sidebar only where there is room for it. On a 1280px
 * laptop a 224px column is 18% of the screen for four links, so below the
 * expanded breakpoint the sidebar collapses to an icon rail and the student can
 * still pin it open.
 */
export type SidebarMode = 'auto' | 'expanded' | 'collapsed';

const KEY = 'chalkwise.sidebar';
const listeners = new Set<() => void>();

function read(): SidebarMode {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored === 'expanded' || stored === 'collapsed' || stored === 'auto') return stored;
  } catch {
    // Private windows and blocked site data throw; the default is fine.
  }
  return 'auto';
}

let mode: SidebarMode = read();

export function getSidebarMode(): SidebarMode {
  return mode;
}

export function setSidebarMode(next: SidebarMode) {
  if (next === mode) return;
  mode = next;
  try {
    globalThis.localStorage?.setItem(KEY, next);
  } catch {
    // Preference is a convenience; losing it must not break navigation.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server rendering has no viewport, so it always reports the stored default. */
export function useSidebarMode(): SidebarMode {
  return useSyncExternalStore(subscribe, getSidebarMode, getSidebarMode);
}
