// build-spots.mjs
// Generates a bundled OSM spot list for Israel and writes it to src/data/spots-il.json
// Run with: node build-spots.mjs (working directory: apps/sunset-spots)

// Using global fetch (Node 18+). No import needed.

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Filters identical to src/lib/osm.ts
const FILTERS = [
  ['tourism', 'viewpoint'],
  ['natural', 'peak'],
  ['tourism', 'picnic_site'],
  ['leisure', 'picnic_table'],
  ['amenity', 'bench'],
  ['amenity', 'shelter'],
];

function buildIsraelQuery() {
  // Bounding box for Israel: south, west, north, east
  const south = 29.45, west = 34.27, north = 33.34, east = 35.85;
  const parts = FILTERS.map(([k, v]) =>
    `nwr["${k}"="${v}"](${south},${west},${north},${east});`
  ).join('');
  return `[out:json][timeout:25];(${parts});out center tags;`;
}

function kindOf(tags) {
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.natural === 'peak') return 'peak';
  if (tags.tourism === 'picnic_site' || tags.leisure === 'picnic_table') return 'picnic';
  if (tags.amenity === 'bench') return 'bench';
  if (tags.amenity === 'shelter') return 'shelter';
  return null;
}

async function fetchIsraelSpots() {
  const query = buildIsraelQuery();
  console.log('Query:', query.slice(0, 120) + '...');
  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
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
  const json = await response.json();
  const spots = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const kind = kindOf(tags);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!kind || lat === undefined || lon === undefined) continue;
    spots.push({
      id: `${el.type}/${el.id}`,
      kind,
      name: tags['name:he'] ?? tags.name ?? null,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      tags,
    });
  }
  return spots;
}

async function main() {
  console.log('Fetching Israel spots from Overpass...');
  const spots = await fetchIsraelSpots();
  const outDir = path.resolve('src/data');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'spots-il.json');
  await writeFile(outPath, JSON.stringify(spots, null, 2), 'utf8');
  const sizeMiB = (Buffer.byteLength(JSON.stringify(spots)) / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${spots.length} spots to ${outPath} (${sizeMiB} MiB)`);
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
