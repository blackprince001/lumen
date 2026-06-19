import type { MapNode } from './api/citationMap';

export interface LaidOutNode {
  x: number;
  y: number;
  r: number;
}

const CANVAS_W = 1600;
const CANVAS_H = 1000;
const MIN_R = 13;
const MAX_R = 44;
const FOCAL_R = 30;


function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function radiusFor(node: MapNode): number {
  if (node.is_focal) return FOCAL_R;
  const c = node.citation_count ?? 0;

  const t = Math.min(1, Math.log10(c + 1) / 4); // 
  return MIN_R + t * (MAX_R - MIN_R);
}


export function computeLayout(nodes: MapNode[]): Record<string, LaidOutNode> {
  const years = nodes.map((n) => n.year).filter((y): y is number => y != null);
  const minYear = years.length ? Math.min(...years) : 2000;
  const maxYear = years.length ? Math.max(...years) : 2020;
  const yearSpan = Math.max(1, maxYear - minYear);

  const counts = nodes
    .map((n) => n.citation_count)
    .filter((c): c is number => c != null && c > 0);
  const maxLog = counts.length
    ? Math.max(...counts.map((c) => Math.log10(c + 1)))
    : 1;

  const out: Record<string, LaidOutNode> = {};
  const padX = 90;
  const padY = 80;
  const usableW = CANVAS_W - padX * 2;
  const usableH = CANVAS_H - padY * 2;

  for (const node of nodes) {
    const r = radiusFor(node);

    if (node.position) {
      out[node.key] = { x: node.position.x, y: node.position.y, r };
      continue;
    }

    const j = hash01(node.key);
    const j2 = hash01(node.key + '#');

    const yearT = node.year != null ? (node.year - minYear) / yearSpan : j;
    const cx = padX + yearT * usableW + (j - 0.5) * 46;

    let countT: number;
    if (node.is_focal) {
      countT = node.citation_count != null && maxLog > 0
        ? Math.log10(node.citation_count + 1) / maxLog
        : 0.82;
    } else {
      const c = node.citation_count ?? 0;
      countT = maxLog > 0 ? Math.log10(c + 1) / maxLog : 0;
    }
    const cy = padY + (1 - countT) * usableH + (j2 - 0.5) * 46;

    out[node.key] = { x: cx - r, y: cy - r, r };
  }

  return out;
}
