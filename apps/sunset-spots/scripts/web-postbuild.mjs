// web-postbuild.mjs
// Turns `expo export -p web` (dist/) into an installable, offline-capable web app:
//   - icons + manifest, so "Add to Home Screen" gives a real app icon
//   - a service worker (sw.js) that keeps the app, the spots data and the map tiles you've seen
//   - link-preview tags, so a shared link shows a card in WhatsApp
//   - 404.html, so GitHub Pages serves the app for any path
// Run after the export (working directory: apps/sunset-spots): npm run build:web

import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Jimp from 'jimp-compact';
import { contentVersion } from './sw-version.mjs';

const DIST = path.resolve('dist');
const app = JSON.parse(await readFile('app.json', 'utf8')).expo;
const BASE = `${(app.experiments?.baseUrl ?? '').replace(/\/$/, '')}/`; // "/orkalifa/"
const SITE = 'https://orkalifa.github.io' + BASE;
const THEME = app.web?.themeColor ?? '#1A120E';
const BACKGROUND = app.web?.backgroundColor ?? '#FCF8F2';
const DESCRIPTION = 'המקומות הכי טובים לשקיעה סביבך: נוף פתוח, מתי לצאת, ואיך להגיע.';

// 1. Icons from the app icon (assets/icon.png), so a new icon flows through on the next build.
const icon = await Jimp.read('assets/icon.png');
for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  await icon.clone().resize(size, size).writeAsync(path.join(DIST, name));
}

// 2. Manifest.
const manifest = {
  name: app.name,
  short_name: app.web?.shortName ?? app.name,
  description: DESCRIPTION,
  lang: 'he',
  dir: 'rtl',
  start_url: BASE,
  scope: BASE,
  display: 'standalone',
  orientation: 'portrait',
  background_color: BACKGROUND,
  theme_color: THEME,
  icons: [
    { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};
await writeFile(path.join(DIST, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

// 3. Link-preview image: the app's main screen.
await copyFile('docs/sunlit-main-web.png', path.join(DIST, 'og.png'));

// 4. Head tags + service worker registration.
const head = `
<meta name="description" content="${DESCRIPTION}">
<link rel="manifest" href="${BASE}manifest.webmanifest">
<link rel="apple-touch-icon" href="${BASE}apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${app.name}">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta property="og:type" content="website">
<meta property="og:title" content="${app.name}: איפה רואים הכי טוב את השקיעה">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:url" content="${SITE}">
<meta property="og:locale" content="he_IL">
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${BASE}sw.js', { scope: '${BASE}', updateViaCache: 'none' }).then(function (reg) {
      // An installed app is often resumed rather than reopened: look for a new version when it comes back.
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    });
  });
}
</script>
`;
let html = await readFile(path.join(DIST, 'index.html'), 'utf8');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${head}</head>`);
await writeFile(path.join(DIST, 'index.html'), html);
await writeFile(path.join(DIST, '404.html'), html);
await writeFile(path.join(DIST, '.nojekyll'), '');

// 5. Service worker: precache every built file. Written last, so the version covers the final index.html;
// it is a hash of the files' CONTENTS, so an icon or manifest changed under the same name still updates installed apps.
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(path.relative(DIST, full).split(path.sep).join('/'));
  }
  return out;
}
// The font package ships every Rubik weight; the app uses 400–700 upright (see src/app/_layout.tsx).
const NOT_PRECACHED = ['og.png', 'metadata.json', '404.html', '.nojekyll', 'sw.js'];
const unused = (f) => NOT_PRECACHED.includes(f) || f.endsWith('.map') || /Rubik_(300|800|900)|Italic/.test(f);
const files = (await walk(DIST)).filter((f) => !unused(f)).sort();
const precache = [BASE, ...files.filter((f) => f !== 'index.html').map((f) => BASE + f)];
const version = contentVersion(
  await Promise.all(files.map(async (f) => ({ path: f, bytes: await readFile(path.join(DIST, f)) }))),
);
const sw = (await readFile('scripts/sw-template.js', 'utf8'))
  .replace('__VERSION__', version)
  .replace('__BASE__', BASE)
  .replace("'__PRECACHE__'", JSON.stringify(precache));
await writeFile(path.join(DIST, 'sw.js'), sw);

console.log(`web-postbuild: ${precache.length} files precached, version ${version}`);
