import type { Paper } from '@/lib/api/papers';

/** Joined author names from metadata_json, or null. */
export function paperAuthors(paper: Paper): string | null {
  const list = paper.metadata_json?.authors_list;
  if (Array.isArray(list) && list.length > 0) return list.join(', ');
  if (paper.metadata_json?.author) return String(paper.metadata_json.author);
  return null;
}

/** Four-digit publication year from metadata_json, or null. */
export function paperYear(paper: Paper): string | null {
  const pubDate = paper.metadata_json?.publication_date;
  if (pubDate) return String(pubDate).slice(0, 4);
  const year = paper.metadata_json?.year;
  if (year) return String(year);
  return null;
}
