import { useCallback, useSyncExternalStore } from 'react';

const queries = new Map<string, { mql: MediaQueryList; listeners: Set<() => void> }>();

function ensure(query: string) {
  let entry = queries.get(query);
  if (!entry) {
    const mql = window.matchMedia(query);
    entry = { mql, listeners: new Set() };
    mql.addEventListener('change', () => {
      for (const listener of entry!.listeners) listener();
    });
    queries.set(query, entry);
  }
  return entry;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = ensure(query);
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    [query],
  );
  const getSnapshot = useCallback(() => ensure(query).mql.matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export const MOBILE_QUERY = '(max-width: 860px)';
