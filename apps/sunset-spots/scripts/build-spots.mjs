// build-spots.mjs
// Generates the bundled OSM spot list for Israel: src/data/spots-il.json (+ spots-il.meta.json).
// Run with: npm run build:spots   (working directory: apps/sunset-spots)
//           npm run build:spots -- --force   to accept a drop of more than 10% in spots.
//
// Safety: a bad Overpass answer never replaces the file. The response is rejected on a non-200
// status or a `remark`, the spots must pass validateSpots (count, shape, bounds), and the file is
// written to a temp file, re-checked, then renamed over the old one.

import { readFile, writeFile, rename, rm, mkdir } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildIsraelQuery, checkOverpassResponse, toSpots, validateSpots } from './spots-build.ts';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function fetchIsraelSpots() {
  const query = buildIsraelQuery();
  console.log('Query:', query.slice(0, 120) + '...');
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Spotlight/1.0 (sunset spots app)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Overpass error ${response.status}: ${body.slice(0, 200)}`);
  }
  return toSpots(checkOverpassResponse(response.status, await response.json()));
}

/** Count of spots in the current file, or undefined if there is no readable file. */
async function currentCount(file) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(data) ? data.length : undefined;
  } catch {
    return undefined;
  }
}

/** Write to a temp file next to the target, run `check` on what was written, then rename over it. */
async function writeAtomic(file, text, check) {
  const tmp = `${file}.tmp`;
  try {
    await writeFile(tmp, text, 'utf8');
    if (check) check(await readFile(tmp, 'utf8'));
    await rename(tmp, file);
  } finally {
    await rm(tmp, { force: true });
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const outDir = path.resolve('src/data');
  const outPath = path.join(outDir, 'spots-il.json');
  const metaPath = path.join(outDir, 'spots-il.meta.json');

  console.log('Fetching Israel spots from Overpass...');
  const spots = await fetchIsraelSpots();
  const previousCount = await currentCount(outPath);
  const opts = { previousCount, force };

  const result = validateSpots(spots, opts);
  if (!result.ok) {
    console.error(`Refusing to write ${outPath}:`);
    for (const e of result.errors) console.error('  - ' + e);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const text = JSON.stringify(spots);
  await writeAtomic(outPath, text, (written) => {
    const again = validateSpots(JSON.parse(written), opts);
    if (!again.ok) throw new Error('Written file failed validation: ' + again.errors.join('; '));
  });
  const meta = {
    generatedAt: new Date().toISOString(),
    count: spots.length,
    source: 'OpenStreetMap via Overpass',
    license: 'ODbL',
  };
  await writeAtomic(metaPath, JSON.stringify(meta, null, 2) + '\n');

  const sizeMiB = (Buffer.byteLength(text) / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${spots.length} spots to ${outPath} (${sizeMiB} MiB)` + (previousCount ? `, was ${previousCount}` : ''));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
}
