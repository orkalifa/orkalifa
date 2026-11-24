#!/usr/bin/env node
// Post-deploy smoke check for the live Spotlight site (run by .github/workflows/deploy-spotlight.yml).
// Opens the site in headless Chromium with a fixed public location (central Tel Aviv) and checks
// that it loads without script errors, shows tonight's sunset and the list of spots, and that the
// PWA files are served. Exits 1 with a reason (and saves smoke-failure.png) if anything is wrong.
// Usage: node scripts/smoke-live.mjs [url]   (needs the `playwright` package and its Chromium)
const URL_ = process.argv[2] || process.env.SMOKE_URL || 'https://orkalifa.github.io/orkalifa/';
const TIMEOUT_MS = 45_000;
const ATTEMPTS = 3; // Pages can take a moment to serve a fresh deploy.

let playwright;
try {
  playwright = await import('playwright');
} catch {
  const { createRequire } = await import('node:module');
  playwright = createRequire(`${process.env.PLAYWRIGHT_DIR}/`)('playwright');
}
const { chromium } = playwright;

async function check() {
  for (const f of ['manifest.webmanifest', 'sw.js']) {
    const r = await fetch(new URL(f, URL_), { cache: 'no-store' });
    if (!r.ok) throw new Error(`${f} returned HTTP ${r.status}`);
  }

  // SMOKE_CHANNEL=chrome uses an installed Google Chrome instead of Playwright's Chromium (local runs).
  const browser = await chromium.launch(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {});
  const context = await browser.newContext({
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    geolocation: { latitude: 32.0853, longitude: 34.7818 },
    permissions: ['geolocation'],
    serviceWorkers: 'block', // check the network build, not a cached one
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const res = await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    if (!res || !res.ok()) throw new Error(`page returned HTTP ${res?.status()}`);
    await page.getByText(/השקיעה (היום|מחר)/).first().waitFor({ timeout: TIMEOUT_MS });
    await page.getByText('מקומות לשקיעה סביבך').first().waitFor({ timeout: TIMEOUT_MS });
    if (errors.length) throw new Error(`script errors: ${errors.slice(0, 3).join(' | ')}`);
  } catch (e) {
    await page.screenshot({ path: 'smoke-failure.png', fullPage: true }).catch(() => {});
    throw e;
  } finally {
    await browser.close();
  }
}

for (let i = 1; i <= ATTEMPTS; i++) {
  try {
    await check();
    console.log(`Smoke check passed: ${URL_}`);
    process.exit(0);
  } catch (e) {
    console.error(`Attempt ${i}/${ATTEMPTS} failed: ${e.message}`);
    if (i < ATTEMPTS) await new Promise((r) => setTimeout(r, 20_000));
  }
}
console.error('Smoke check FAILED: the live site is broken. See smoke-failure.png in the run artifacts.');
process.exit(1);
