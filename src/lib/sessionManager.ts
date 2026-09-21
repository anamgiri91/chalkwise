export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
};
export type RefreshStore = {
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
};

/** Single-flight refresh and generation checks prevent a late response undoing sign-out. */
export function createSessionManager(deps: {
  store: RefreshStore;
  refresh(token: string): Promise<AuthSession>;
  now?: () => number;
}) {
  let session: AuthSession | null = null;
  let loaded = false;
  let generation = 0;
  let pending: Promise<AuthSession | null> | null = null;
  let writes = Promise.resolve();
  const listeners = new Set<(id: string | null) => void>();
  const notify = () => listeners.forEach((listener) => listener(session?.userId ?? null));
  const persist = (value: string | null) => {
    writes = writes.catch(() => {}).then(() => deps.store.write(value));
    return writes;
  };
  return {
    subscribe(listener: (id: string | null) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async set(next: AuthSession) {
      const version = ++generation;
      await persist(next.refreshToken);
      if (version !== generation) return;
      session = next;
      loaded = true;
      notify();
    },
    async clear() {
      generation++;
      session = null;
      loaded = true;
      pending = null;
      notify();
      await persist(null);
    },
    async get(): Promise<AuthSession | null> {
      if (session && session.expiresAt > (deps.now?.() ?? Date.now()) + 30000) return session;
      if (pending) return pending;
      const version = generation;
      const current = (async () => {
        const refreshToken = session?.refreshToken ?? (!loaded ? await deps.store.read() : null);
        if (version !== generation) return null;
        if (!refreshToken) {
          loaded = true;
          return null;
        }
        const refreshed = await deps.refresh(refreshToken);
        if (version !== generation) return null;
        session = refreshed;
        loaded = true;
        notify();
        return refreshed;
      })();
      pending = current;
      try {
        return await current;
      } finally {
        if (pending === current) pending = null;
      }
    },
  };
}
