// Builds assets/icons/*.svg from Lumen's own icon paths in frontend-v2.
//
//   node scripts/gen-icons.mjs
//
// Each icon is outline-only: the web `createIcon` factory owns stroke, caps
// and joins, so we do the same here. The secondary (duotone) layer is dropped.
// Stroke is 2 units on the 24 grid, which draws at about 1.35px at 16px, the
// weight the design uses. Icons listed in LARGE also get a `-lg` variant at
// 1.5 units for 22px settings tabs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../../frontend-v2/src/components/icons');
const out = join(here, '../assets/icons');

const ICONS = [
  'home', 'chart-bars', 'file-text', 'library', 'discover', 'microscope', 'feed',
  'sparkles', 'archive', 'citation-graph', 'users', 'folder', 'folder-open',
  'chevron-right', 'chevron-down', 'panel-left-close', 'panel-left-open',
  'panel-right-open', 'panel-right-close', 'plus', 'search', 'view-grid',
  'view-list', 'settings', 'chip', 'palette', 'user', 'logout', 'spinner',
  'close', 'check', 'warning', 'book-open', 'file',
];
const LARGE = ['settings', 'chip', 'palette', 'user'];

/** The JSX after `path:` up to the matching end of the expression. */
function pathMarkup(tsx) {
  const start = tsx.indexOf('path:');
  let i = start + 5;
  while (/\s|\(/.test(tsx[i])) i++;
  let depth = 0;
  let j = i;
  for (; j < tsx.length; j++) {
    if (tsx.startsWith('</', j)) {
      depth--;
      j = tsx.indexOf('>', j);
      if (depth === 0) break;
    } else if (tsx[j] === '<') {
      const close = tsx.indexOf('>', j);
      const selfClosing = tsx[close - 1] === '/';
      if (!selfClosing) depth++;
      else if (depth === 0) {
        j = close;
        break;
      }
      j = close;
    }
  }
  return tsx
    .slice(i, j + 1)
    .replace(/<\/?>/g, '')
    .replace(/fillRule/g, 'fill-rule')
    .replace(/clipRule/g, 'clip-rule')
    .replace(/strokeLinecap/g, 'stroke-linecap')
    .replace(/strokeLinejoin/g, 'stroke-linejoin')
    .replace(/\s+/g, ' ')
    .trim();
}

function svg(body, width) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
}

mkdirSync(out, { recursive: true });
for (const name of ICONS) {
  const body = pathMarkup(readFileSync(join(src, `${name}.tsx`), 'utf8'));
  writeFileSync(join(out, `${name}.svg`), svg(body, 2));
  if (LARGE.includes(name)) writeFileSync(join(out, `${name}-lg.svg`), svg(body, 1.5));
}
console.log(`wrote ${ICONS.length + LARGE.length} icons to ${out}`);
