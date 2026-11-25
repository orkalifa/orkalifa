import { destinationPoint, type LatLon } from './geo.ts';
import { privateLonStep } from './horizon.ts';

/**
 * "שווה לצאת היום?" — how good tonight's sunset should look, from Open-Meteo's cloud forecast
 * (free, no key) at the hour of sunset.
 *
 * What makes a colourful sunset: some high or mid-level cloud overhead to catch the light, and a
 * clear horizon toward the sun so the light reaches them. Low cloud on that horizon hides the sun;
 * a sky fully covered stays grey; a sky with no cloud at all is pretty but plain.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
/** Where to check the horizon: this far toward the sunset (low cloud there blocks the sun). */
export const HORIZON_KM = 40;

export type SkyTone = 'great' | 'clear' | 'ok' | 'poor';
export type SkyVerdict = { tone: SkyTone; label: string };

/** Cloud cover (0–100 %) and rain chance at the hour of sunset. */
export type CloudHour = { low: number; mid: number; high: number; rain: number };

export function rateSunset(here: CloudHour, horizonLow: number): SkyVerdict {
  const upper = Math.max(here.mid, here.high);
  if (here.rain >= 60) return { tone: 'poor', label: 'צפוי גשם' };
  if (here.low >= 75 || horizonLow >= 70) return { tone: 'poor', label: 'עננים יסתירו את השמש' };
  if (upper >= 25 && upper <= 80 && here.low < 50 && horizonLow < 50) return { tone: 'great', label: 'צפויה שקיעה צבעונית' };
  if (Math.max(here.low, here.mid, here.high) < 15) return { tone: 'clear', label: 'שמיים נקיים' };
  if (upper > 80) return { tone: 'poor', label: 'שמיים מכוסים' };
  return { tone: 'ok', label: 'שווה לנסות' };
}

/**
 * Height of a sky-forecast cell: 0.01° of latitude ≈ 1.1 km. The forecast models are coarser than
 * that anyway, so it's all a weather service needs.
 */
export const SKY_STEP_DEG = 0.01;

const roundTo = (x: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
};

/** Longitude wrapped into [-180, 180). */
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * A point snapped to the sky grid: latitude to 0.01° (~1.1 km), longitude to whole steps of
 * `privateLonStep(lat, SKY_STEP_DEG)`, so a cell is ≥ ~1.1 km east-west at every latitude (a fixed
 * 0.01° was ~944 m in Israel and ~556 m at 60°N), wrapped into [-180, 180). Pure and idempotent:
 * snapping a snapped point changes nothing, so the request and `useSky`'s key agree. The longitude is
 * printed to 4 decimals (≤ ~6 m off the grid point, far inside its ≥ 1.1 km cell).
 */
export function skyCell({ lat, lon }: LatLon): LatLon {
  const rLat = roundTo(Math.min(90, Math.max(-90, Math.round(lat / SKY_STEP_DEG) * SKY_STEP_DEG)), 6);
  const step = privateLonStep(rLat, SKY_STEP_DEG);
  const rLon = roundTo(wrapLon(Math.round(wrapLon(lon) / step) * step), 4);
  // `+ 0` turns -0 into 0, so the same cell always prints the same.
  return { lat: rLat + 0, lon: (rLon >= 180 ? rLon - 360 : rLon) + 0 };
}

/**
 * The forecast request. This, and only this, leaves the phone for the sky verdict: one GET to
 * api.open-meteo.com/v1/forecast with two points, your position snapped to the sky grid (`skyCell`,
 * a cell of ~1.1 km × ≥ ~1.1 km anywhere on Earth) and the point 40 km toward the sunset, worked out
 * from that snapped point along the sunset bearing (`skyRequestKey` rounds it to 1°) and snapped the
 * same way, plus the fixed list of forecast fields below. Your exact position, saved places, ids and
 * the time are in no request. Like any web request, it also shows Open-Meteo the phone's IP address.
 */
export function forecastUrl(here: LatLon, sunsetBearing: number): string {
  const h = skyCell(here);
  const far = skyCell(destinationPoint(h, sunsetBearing, HORIZON_KM * 1000));
  const lats = `${h.lat},${far.lat}`;
  const lons = `${h.lon},${far.lon}`;
  return (
    `${FORECAST_URL}?latitude=${lats}&longitude=${lons}` +
    '&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation_probability' +
    '&forecast_days=2&timeformat=unixtime'
  );
}

type Hourly = {
  time: number[];
  cloud_cover_low: (number | null)[];
  cloud_cover_mid: (number | null)[];
  cloud_cover_high: (number | null)[];
  precipitation_probability?: (number | null)[];
};

/** The forecast hour closest to `at`, or null if the forecast doesn't reach it. */
export function hourAt(hourly: Hourly, at: Date): CloudHour | null {
  const t = at.getTime() / 1000;
  let best = -1;
  hourly.time.forEach((h, i) => {
    if (best < 0 || Math.abs(h - t) < Math.abs(hourly.time[best] - t)) best = i;
  });
  if (best < 0 || Math.abs(hourly.time[best] - t) > 90 * 60) return null;
  return {
    low: hourly.cloud_cover_low[best] ?? 0,
    mid: hourly.cloud_cover_mid[best] ?? 0,
    high: hourly.cloud_cover_high[best] ?? 0,
    rain: hourly.precipitation_probability?.[best] ?? 0,
  };
}

/** Parses the two-location answer (here, then the horizon point) into tonight's verdict. */
export function verdictFromForecast(json: unknown, sunset: Date): SkyVerdict | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  const [here, far] = json.map((loc) => (loc as { hourly?: Hourly }).hourly);
  if (!here || !far) return null;
  const h = hourAt(here, sunset);
  const f = hourAt(far, sunset);
  if (!h || !f) return null;
  return rateSunset(h, f.low);
}

export type SkyRequestKey = { lat: number; lon: number; bearing: number; sunsetMs: number };

/**
 * What `useSky` fetches for, as primitives: the sky cell (`skyCell`), the sunset bearing to 1° and the
 * sunset to the minute. Moving inside a cell, a bearing that drifts by a fraction of a degree or a
 * sunset a few seconds off give the same key, so nothing refetches. Since `skyCell` is idempotent, the
 * request built from the key is exactly the one built from the raw position. Missing or non-finite
 * input (no fix yet, a NaN from the GPS) gives null: no request at all.
 */
export function skyRequestKey(
  coords: { latitude: number; longitude: number } | null,
  bearing: number | null,
  sunset: Date | null,
): SkyRequestKey | null {
  if (!coords || bearing === null || !sunset) return null;
  const sunsetMs = Math.round(sunset.getTime() / 60000) * 60000;
  if (![coords.latitude, coords.longitude, bearing, sunsetMs].every(Number.isFinite)) return null;
  const { lat, lon } = skyCell({ lat: coords.latitude, lon: coords.longitude });
  return { lat, lon, bearing: Math.round(bearing), sunsetMs };
}

export async function fetchSkyVerdict(here: LatLon, sunsetBearing: number, sunset: Date, signal?: AbortSignal): Promise<SkyVerdict | null> {
  const response = await fetch(forecastUrl(here, sunsetBearing), { signal });
  if (!response.ok) throw new Error(`Open-Meteo forecast: HTTP ${response.status}`);
  return verdictFromForecast(await response.json(), sunset);
}
