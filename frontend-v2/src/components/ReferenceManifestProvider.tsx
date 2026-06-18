import { createContext, useContext, useMemo, useCallback } from "react";
import type { ReferenceManifestEntry } from "@/lib/api/references";

interface ReferenceManifestContextValue {
  getEntry: (kind: string, id: string) => ReferenceManifestEntry | null;
  has: (kind: string, id: string) => boolean;
  entries: ReferenceManifestEntry[];
}

const ReferenceManifestContext =
  createContext<ReferenceManifestContextValue | null>(null);

export function useReferenceManifest(): ReferenceManifestContextValue | null {
  return useContext(ReferenceManifestContext);
}

export function ReferenceManifestProvider({
  manifest,
  children,
}: {
  manifest?: ReferenceManifestEntry[] | null;
  children: React.ReactNode;
}) {
  const entries = manifest ?? [];

  const entryMap = useMemo(() => {
    const map = new Map<string, ReferenceManifestEntry>();
    for (const e of entries) {
      map.set(`${e.kind}/${e.id}`, e);
    }
    return map;
  }, [entries]);

  const getEntry = useCallback(
    (kind: string, id: string): ReferenceManifestEntry | null => {
      return entryMap.get(`${kind}/${id}`) ?? null;
    },
    [entryMap],
  );

  const has = useCallback(
    (kind: string, id: string): boolean => {
      return entryMap.has(`${kind}/${id}`);
    },
    [entryMap],
  );

  const value = useMemo(
    () => ({ getEntry, has, entries }),
    [getEntry, has, entries],
  );

  return (
    <ReferenceManifestContext.Provider value={value}>
      {children}
    </ReferenceManifestContext.Provider>
  );
}
