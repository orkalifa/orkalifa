// "Sunlit Atlas" palette for Spotlight: warm sunlit parchment paired with deep espresso-obsidian
// chrome and a living sunset accent that shifts gently with the time of day.
export const colors = {
  // Warm parchment & crisp card hierarchy
  ground: '#F5EDE3',
  sheet: '#FCF8F2',
  surface: '#FFFFFF',
  sand: '#F5E5D2',
  sandSoft: '#FBF3E8',
  peach: '#F4BE94',

  // Deep espresso-obsidian HUD & primary ink (high contrast, warm — never cold black)
  obsidian: '#1A120E',
  obsidianSoft: '#271C16',
  obsidianBorder: 'rgba(255, 224, 185, 0.14)',
  ink: '#21150F',
  inkSoft: '#4E3527',
  muted: '#7B5C4B',
  mutedSoft: '#9D7F6E',
  line: '#EAE0D3',
  lineStrong: '#DECDBB',

  // Solar & reach accents
  orange: '#E55B24',
  orangeSoft: '#FBE6DA',
  orangeText: '#B54215',
  gold: '#F2A92C',
  goldSoft: '#FDF2D6',
  goldText: '#9A6307',
  sage: '#5E7A4C',
  sageSoft: '#EAF0E2',
  white: '#FFFFFF',
};

export const fonts = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
};

export type SkyPhase = {
  id: 'afternoon' | 'golden' | 'imminent' | 'twilight';
  label: string;
  accent: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
  /** Progress 0..1 from 2 hours before sunset through sunset itself. */
  progress: number;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/** Shifts subtle HUD accents and copy to match how close tonight's sunset is. */
export function getSkyPhase(now: Date, goldenHour: Date, sunset: Date, isTomorrow: boolean): SkyPhase {
  const msToSunset = sunset.getTime() - now.getTime();
  const msToGolden = goldenHour.getTime() - now.getTime();

  if (isTomorrow || msToSunset <= 0) {
    return {
      id: 'twilight',
      label: 'מתכוננים למחר',
      accent: '#E07A5F',
      glow: 'rgba(224, 122, 95, 0.28)',
      badgeBg: 'rgba(224, 122, 95, 0.22)',
      badgeText: '#FFD3C4',
      progress: 0.08,
    };
  }

  const progress = Math.max(0.06, Math.min(1, 1 - msToSunset / TWO_HOURS_MS));

  if (msToSunset <= 20 * 60000) {
    return {
      id: 'imminent',
      label: 'השמש ממש יורדת',
      accent: '#FF6B35',
      glow: 'rgba(255, 107, 53, 0.34)',
      badgeBg: 'rgba(255, 107, 53, 0.24)',
      badgeText: '#FFC8B0',
      progress,
    };
  }

  if (msToGolden <= 0) {
    return {
      id: 'golden',
      label: 'שעת הזהב עכשיו',
      accent: '#F5A623',
      glow: 'rgba(245, 166, 35, 0.32)',
      badgeBg: 'rgba(245, 166, 35, 0.22)',
      badgeText: '#FFE1A3',
      progress,
    };
  }

  return {
    id: 'afternoon',
    label: 'יש זמן בנחת',
    accent: '#F2B23E',
    glow: 'rgba(242, 178, 62, 0.25)',
    badgeBg: 'rgba(242, 178, 62, 0.18)',
    badgeText: '#FDE4AF',
    progress,
  };
}
