// Shared by the app (lib/osm.ts) and the build script (scripts/spots-build.ts), so both reject the
// same bad answers. Pure and erasable TypeScript: no Node or React Native APIs, so Node runs it directly.

/**
 * Throws unless `json` is a usable Overpass answer. Overpass reports runtime errors ("Query timed out",
 * "out of memory") as HTTP 200 with a `remark` and few or no elements, so a non-empty remark or a
 * missing `elements` array means that server failed. The message is short: the app shows it.
 */
export function checkOverpassJson(json: unknown): { elements: unknown[] } {
  if (!json || typeof json !== 'object') throw new Error('no JSON object');
  const { remark, elements } = json as { remark?: unknown; elements?: unknown };
  if (typeof remark === 'string' && remark.trim()) throw new Error(`remark: ${remark.trim().slice(0, 120)}`);
  if (!Array.isArray(elements)) throw new Error('no elements array');
  return { elements };
}
