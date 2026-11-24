/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { contentVersion } from '../scripts/sw-version.mjs';

const files = [
  { path: 'index.html', bytes: '<html>app</html>' },
  { path: 'icon-192.png', bytes: new Uint8Array([1, 2, 3]) },
  { path: 'manifest.webmanifest', bytes: '{"name":"Spotlight"}' },
];

test('version changes when a file changes but its name does not', () => {
  const newIcon = files.map((f) => (f.path === 'icon-192.png' ? { ...f, bytes: new Uint8Array([1, 2, 4]) } : f));
  assert.notEqual(contentVersion(newIcon), contentVersion(files));
});

test('version is the same for the same files in any order', () => {
  assert.equal(contentVersion([...files].reverse()), contentVersion(files));
  assert.match(contentVersion(files), /^[0-9a-f]{12}$/);
});

test('version changes when a file is added', () => {
  assert.notEqual(contentVersion([...files, { path: 'favicon.ico', bytes: 'x' }]), contentVersion(files));
});

test('moving bytes between file names changes the version', () => {
  const a = [{ path: 'a', bytes: 'xy' }, { path: 'b', bytes: '' }];
  const b = [{ path: 'a', bytes: 'x' }, { path: 'b', bytes: 'y' }];
  assert.notEqual(contentVersion(a), contentVersion(b));
});

// The service worker is a plain script; run it in a sandbox with a stub `self` and call its pure router.
type Route = 'app' | 'tilejson' | 'tile' | 'data' | null;
function loadRouter(): (url: URL, base: string, origin: string) => Route {
  const source = readFileSync(new URL('../scripts/sw-template.js', import.meta.url), 'utf8');
  const sandbox: Record<string, unknown> = { self: { addEventListener() {} } };
  vm.runInNewContext(source, sandbox);
  return sandbox.routeFor as (url: URL, base: string, origin: string) => Route;
}

test('service worker sends each request to the right cache rule', () => {
  const routeFor = loadRouter();
  const origin = 'https://orkalifa.github.io';
  const route = (u: string) => routeFor(new URL(u), '/orkalifa/', origin);
  assert.equal(route('https://tiles.openfreemap.org/planet'), 'tilejson');
  assert.equal(route('https://tiles.openfreemap.org/planet/20251120_001001_pt/12/2440/1660.pbf'), 'tile');
  assert.equal(route('https://api.open-meteo.com/v1/elevation?latitude=32.1&longitude=34.8'), 'data');
  assert.equal(route('https://api.open-meteo.com/v1/forecast?latitude=32.1&longitude=34.8'), 'data');
  assert.equal(route('https://orkalifa.github.io/orkalifa/_expo/static/js/web/entry.js'), 'app');
  assert.equal(route('https://orkalifa.github.io/other/x.js'), null);
  assert.equal(route('https://overpass-api.de/api/interpreter'), null);
});
