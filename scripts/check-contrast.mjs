#!/usr/bin/env node
// Reads the colour tokens straight out of src/App.css and computes WCAG contrast
// ratios, so the numbers can't drift from what we're actually shipping.
// Run: npm run check:contrast

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '../src/App.css');
const css = readFileSync(cssPath, 'utf8');

// ── Parse :root custom properties that hold a hex colour ──────────
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const tokens = {};
for (const m of root.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  tokens[m[1]] = m[2];
}

// ── WCAG 2.1 relative luminance + contrast ────────────────────────
const srgb = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ── The pairs we actually render ──────────────────────────────────
// min 4.5 = WCAG AA body text (1.4.3).
// min 3   = large text (>=18.66px bold / >=24px), or a non-text graphical
//           object such as an icon glyph or control outline (1.4.11).
const PAIRS = [
  ['ink',        'ground',    'Body text on the page',            4.5],
  ['ink',        'surface',   'Body text on cards',               4.5],
  ['ink',        'surface-2', 'Text on recessed areas',           4.5],
  ['ink-soft',   'surface',   'Secondary text on cards',          4.5],
  ['ink-soft',   'ground',    'Secondary text on the page',       4.5],
  ['ink-soft',   'surface-2', 'Secondary text on recessed areas', 4.5],
  ['accent-ink', 'surface',   'Accent text on cards',             4.5],
  ['accent-ink', 'ground',    'Accent text on the page',          4.5],
  ['ink',        'accent',    'Button label on accent fill',      4.5],
  ['surface',    'danger',    'Button label on danger fill',      4.5],
  ['ground',     'ink',       'Inverted chip label',              4.5],
  ['ink',        'gold',      'Label on gold fill',               4.5],
  ['gold-ink',   'surface',   'Gold accent text',                 4.5],
  ['danger-ink', 'surface',   'Error text on cards',              4.5],
  ['done-ink',   'surface-2', 'Done stamp (large display type)',  3],
  ['surface',    'done',      'Check glyph on done fill',         3],
  ['ink',        'surface',   'Control outlines on cards',        3],
];

let failures = 0;
const rows = [];

for (const [fg, bg, label, min] of PAIRS) {
  const fgHex = tokens[fg];
  const bgHex = tokens[bg];
  if (!fgHex || !bgHex) {
    console.error(`MISSING token: --${fg} or --${bg}`);
    failures++;
    continue;
  }
  const ratio = contrast(fgHex, bgHex);
  const pass = ratio >= min;
  if (!pass) failures++;
  rows.push({
    label,
    pair: `--${fg} on --${bg}`,
    hex: `${fgHex} / ${bgHex}`,
    ratio: ratio.toFixed(2),
    min: min.toFixed(1),
    status: pass ? (min === 3 ? 'PASS' : ratio >= 7 ? 'AAA' : 'AA') : 'FAIL',
  });
}

const w = (s, n) => String(s).padEnd(n);
console.log('');
console.log(`Contrast audit — tokens read from ${cssPath.replace(process.cwd(), '.')}`);
console.log('─'.repeat(96));
console.log(w('Usage', 36) + w('Tokens', 30) + w('Ratio', 8) + w('Min', 6) + 'Result');
console.log('─'.repeat(96));
for (const r of rows) {
  console.log(w(r.label, 36) + w(r.pair, 30) + w(r.ratio, 8) + w(r.min, 6) + r.status);
}
console.log('─'.repeat(96));

if (failures) {
  console.error(`\n${failures} pair(s) below the required ratio.\n`);
  process.exit(1);
}
console.log(`\nAll ${rows.length} pairs pass.\n`);
