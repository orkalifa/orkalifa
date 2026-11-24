/**
 * How many people open the app, and how often a shared link gets opened: counts only.
 * GoatCounter (https://www.goatcounter.com): free, no cookies, no personal data, nothing that
 * identifies anyone. Only the web app on the real site counts (not local tests, not the phone build).
 *
 * Never sent: where you are, where a spot is, its name, or the shared link's contents.
 * Only a fixed page name like "/" or "/shared-link-opened".
 *
 * Off until GOATCOUNTER_CODE is set (the "code" from the GoatCounter sign-up).
 */
export const GOATCOUNTER_CODE = '';

const LIVE_HOST = 'orkalifa.github.io';

export type StatEvent = 'open' | 'shared-link-opened' | 'spot-shared' | 'spot-saved';

/** The address that records one count, or null when counting is off here. */
export function countUrl(event: StatEvent, code = GOATCOUNTER_CODE, host = globalThis.location?.host): string | null {
  if (!code || host !== LIVE_HOST) return null;
  const path = event === 'open' ? '/' : `/${event}`;
  const params = [`p=${encodeURIComponent(path)}`, `rnd=${Math.random().toString(36).slice(2, 10)}`];
  if (event !== 'open') params.push('e=true');
  return `https://${code}.goatcounter.com/count?${params.join('&')}`;
}

export function count(event: StatEvent): void {
  // Web only: on the phone build there's no `document` (and no live host to match anyway).
  if (typeof document === 'undefined') return;
  const url = countUrl(event);
  if (!url) return;
  try {
    // A beacon doesn't hold the page up and isn't cancelled if you close it right away.
    if (!globalThis.navigator?.sendBeacon?.(url)) fetch(url, { mode: 'no-cors', keepalive: true }).catch(() => {});
  } catch {
    // Counting must never break the app.
  }
}
