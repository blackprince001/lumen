import type { Group } from '@/lib/api/groups';
import type { Paper } from '@/lib/api/papers';
import { getPaperTheme, type ThemeName } from '@/lib/paper-themes';
import type { FileSystemItem } from '@/components/shadcn/file-system';

/**
 * Adapter between the groups/papers domain and the Finder's flat manifest.
 *
 * Path scheme (identity is id-encoded, display names live in `name`):
 *   own group:     g{id}-{slug}/             e.g. "g3-ml/g7-transformers/"
 *   shared root:   shared/                   virtual folder, not a real group
 *   shared group:  shared/g{id}-{slug}/
 *   paper:         {folder}p{id}-{slug}.pdf  one file item per group membership
 *
 * Slugs are cosmetic: lookups always parse the numeric id, so renames,
 * duplicate names, and "/" inside group names never break paths.
 */

export const SHARED_ROOT = 'shared/';

export interface PaperFileMetadata {
  paperId: number;
  groupId: number | null;
  theme: ThemeName;
  [key: string]: unknown;
}

export interface PathIndex {
  /** Folder path (with trailing slash) → group id. The shared root maps to null. */
  groupByPath: Map<string, number | null>;
  /** Group id → folder path. */
  pathByGroup: Map<number, string>;
  /** File path → paper id. */
  paperByPath: Map<string, number>;
  /** Paper id → every group id it belongs to (for membership edits). */
  groupsByPaper: Map<number, number[]>;
  /** Paper id → the Paper object (first occurrence wins). */
  papers: Map<number, Paper>;
  /** Group id → the Group object. */
  groups: Map<number, Group>;
}

export interface Manifest {
  items: FileSystemItem[];
  index: PathIndex;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

export function folderSegment(group: Pick<Group, 'id' | 'name'>): string {
  return `g${group.id}-${slugify(group.name)}`;
}

/** Parse the group id out of the last segment of a folder path; null for virtual folders. */
export function groupIdFromPath(path: string): number | null {
  const segments = path.replace(/\/$/, '').split('/');
  const match = segments[segments.length - 1]?.match(/^g(\d+)-/);
  return match ? Number(match[1]) : null;
}

export function isSharedPath(path: string): boolean {
  return path === SHARED_ROOT || path.startsWith(SHARED_ROOT);
}

export function isOwnGroup(group: Group, userId: number | undefined): boolean {
  return !group.user_id || group.user_id === userId;
}

export function buildManifest(groups: Group[], userId: number | undefined): Manifest {
  const items: FileSystemItem[] = [];
  const index: PathIndex = {
    groupByPath: new Map(),
    pathByGroup: new Map(),
    paperByPath: new Map(),
    groupsByPaper: new Map(),
    papers: new Map(),
    groups: new Map(),
  };

  const byParent = new Map<number | null, Group[]>();
  for (const g of groups) {
    index.groups.set(g.id, g);
    const key = g.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(g);
  }

  const ownRoots = (byParent.get(null) ?? []).filter((g) => isOwnGroup(g, userId));
  const sharedRoots = groups.filter((g) => g.user_id != null && g.user_id !== userId && g.parent_id == null);

  const addPaper = (paper: Paper, folderPath: string, groupId: number) => {
    const path = `${folderPath}p${paper.id}-${slugify(paper.title)}.pdf`;
    index.paperByPath.set(path, paper.id);
    if (!index.papers.has(paper.id)) index.papers.set(paper.id, paper);
    const memberships = index.groupsByPaper.get(paper.id) ?? [];
    memberships.push(groupId);
    index.groupsByPaper.set(paper.id, memberships);

    const metadata: PaperFileMetadata = {
      paperId: paper.id,
      groupId,
      theme: getPaperTheme(paper.id).name,
    };
    items.push({
      kind: 'file',
      path,
      name: paper.title,
      contentType: 'application/pdf',
      createdAt: paper.created_at,
      updatedAt: paper.updated_at,
      url: paper.file_url,
      // FileSystemFileItem.metadata is Record<string, string>; the component
      // only passes it through, so richer values survive a cast.
      metadata: metadata as unknown as Record<string, string>,
    });
  };

  const addGroupTree = (group: Group, parentPath: string) => {
    const path = `${parentPath}${folderSegment(group)}/`;
    index.groupByPath.set(path, group.id);
    index.pathByGroup.set(group.id, path);

    items.push({
      kind: 'folder',
      path,
      name: group.name,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      metadata: {
        groupId: String(group.id),
        theme: getPaperTheme(group.id).name,
        shared: isSharedPath(path) ? 'true' : 'false',
      },
    } as FileSystemItem);

    for (const paper of group.papers ?? []) addPaper(paper, path, group.id);
    for (const child of byParent.get(group.id) ?? []) addGroupTree(child, path);
  };

  for (const root of ownRoots) addGroupTree(root, '');

  if (sharedRoots.length > 0) {
    index.groupByPath.set(SHARED_ROOT, null);
    items.push({
      kind: 'folder',
      path: SHARED_ROOT,
      name: 'Shared with me',
      metadata: { virtual: 'true', shared: 'true' },
    } as FileSystemItem);
    for (const root of sharedRoots) addGroupTree(root, SHARED_ROOT);
  }

  return { items, index };
}
