// Attribution required by the data licences (see project/research/terms.md).
// Pure module: no React Native imports, so the node tests can check it directly.

export const CREDIT_URLS = {
  osmCopyright: 'https://www.openstreetmap.org/copyright',
  odbl: 'https://opendatacommons.org/licenses/odbl/',
  openMeteo: 'https://open-meteo.com/',
  ccBy: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

/** Credit links may only point at these hosts. */
export const CREDIT_HOSTS = ['www.openstreetmap.org', 'opendatacommons.org', 'open-meteo.com', 'creativecommons.org'] as const;

/** Small text on the map itself (ODbL: must be visible by default). */
export const MAP_CREDIT_LABEL = '© OpenStreetMap contributors';

/** Footer, first line: the map and its data. */
export const FOOTER_MAP_LINE = 'מפה: OpenFreeMap © OpenMapTiles · נתונים: © OpenStreetMap contributors';

/** Footer, second line: the weather forecast (sky verdict) and the elevation data. The link label follows it. */
export const FOOTER_WEATHER_PREFIX = 'נתוני מזג אוויר (כולל תחזית השקיעה) וגובה: ';
export const FOOTER_WEATHER_LABEL = 'Open-Meteo.com';

export const CREDITS_TITLE = 'קרדיטים ורישיונות';

export type CreditItem = {
  text: string;
  links?: readonly { label: string; url: string }[];
};

export const CREDIT_ITEMS: readonly CreditItem[] = [
  {
    text: 'נתוני המקומות והמפה: © OpenStreetMap contributors, ברישיון Open Database License (ODbL).',
    links: [
      { label: 'רישיון ODbL', url: CREDIT_URLS.odbl },
      { label: 'זכויות היוצרים של OpenStreetMap', url: CREDIT_URLS.osmCopyright },
    ],
  },
  {
    text: 'אריחי המפה: OpenFreeMap © OpenMapTiles.',
  },
  {
    text: 'נתוני מזג אוויר, עננים וגובה: Open-Meteo, ברישיון Creative Commons Attribution 4.0 (CC BY 4.0).',
    links: [
      { label: 'Open-Meteo.com', url: CREDIT_URLS.openMeteo },
      { label: 'רישיון CC BY 4.0', url: CREDIT_URLS.ccBy },
    ],
  },
];
