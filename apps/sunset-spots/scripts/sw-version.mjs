// sw-version.mjs
// The service worker's cache version, from the CONTENTS of every precached file (not just their names),
// so a new icon, manifest or HTML under the same file name still reaches people who installed the app.
// Plain JavaScript on purpose: the deploy builds on Node 22, without TypeScript type stripping.

import { createHash } from 'node:crypto';

/**
 * @param {{ path: string, bytes: Uint8Array | string }[]} entries every precached file
 * @returns {string} 12 hex characters; the same files in any order give the same version
 */
export function contentVersion(entries) {
  const hash = createHash('sha256');
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const { path, bytes } of sorted) {
    hash.update(path);
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}
