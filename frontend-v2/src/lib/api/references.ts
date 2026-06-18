import { api } from './client';

export interface ReferenceManifestEntry {
  kind: string;
  id: string;
  label: string;
  title: string;
  subtitle: string;
  snippet: string;
  thumbnail_url: string | null;
  internal: boolean;
  target: string | null;
}

export interface ReferenceManifest {
  entries: ReferenceManifestEntry[];
}

export const referencesApi = {
  resolveBatch: (refs: { kind: string; id: string }[]): Promise<{ entries: ReferenceManifestEntry[] }> =>
    api.post(`/chat/references/resolve`, { refs }),
  /** Lazily render a figure thumbnail — kept off the manifest to avoid DB bloat. */
  figureThumbnail: (paperId: number, index: number): Promise<{ thumbnail_url: string | null }> =>
    api.get(`/papers/${paperId}/figures/${index}/thumbnail`),
};
