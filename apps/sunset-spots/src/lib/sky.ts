import { destinationPoint, type LatLon } from './geo.ts';

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

/** Rounded to ~1 km: the forecast grid is coarser anyway, and it's all a weather service needs. */
const round = (n: number) => Math.round(n * 100) / 100;

export function forecastUrl(here: LatLon, sunsetBearing: number): string {
  const far = destinationPoint(here, sunsetBearing, HORIZON_KM * 1000);
  const lats = [here.lat, far.lat].map(round).join(',');
  const lons = [here.lon, far.lon].map(round).join(',');
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

export async function fetchSkyVerdict(here: LatLon, sunsetBearing: number, sunset: Date, signal?: AbortSignal): Promise<SkyVerdict | null> {
  const response = await fetch(forecastUrl(here, sunsetBearing), { signal });
  if (!response.ok) throw new Error(`Open-Meteo forecast: HTTP ${response.status}`);
  return verdictFromForecast(await response.json(), sunset);
}
