import Svg, { Ellipse, G, Path } from 'react-native-svg';
import type { SpotKind } from '../lib/osm';
import { colors } from '../theme';

// One stroke path per spot type, drawn on a 24×24 grid (circles as two arcs).
export const ICON_PATHS: Record<SpotKind, string> = {
  viewpoint: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0',
  peak: 'M3 19l6-10 4 6 2-3 6 7z',
  picnic: 'M5 8h14M8 8l-3 11M16 8l3 11M6 14h12',
  bench: 'M4 10h16M4 14h16M6 14v5M18 14v5',
  shelter: 'M3 11l9-6 9 6M6 11v8M18 11v8',
  mine: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
};

export const PIN_PATH = 'M20 48C20 48 4 31 4 19A16 16 0 1 1 36 19C36 31 20 48 20 48Z';

/**
 * Playful Waze-style teardrop pin with an icon for the spot type. The tip is the spot's location.
 * `color` says whether you'd make it in time (see lib/travel.ts).
 */
export function SpotPin({
  kind,
  color,
  opacity = 1,
  size = 32,
  shadow = false,
}: {
  kind: SpotKind;
  color: string;
  opacity?: number;
  size?: number;
  shadow?: boolean;
}) {
  return (
    <Svg width={size} height={size * 1.28} viewBox="0 0 40 52" opacity={opacity} accessibilityElementsHidden importantForAccessibility="no">
      {shadow && <Ellipse cx={20} cy={48.5} rx={8} ry={2.8} fill="#2A1A12" opacity={0.18} />}
      <Path d={PIN_PATH} fill={color} stroke={colors.white} strokeWidth={3} />
      <G transform="translate(10 9) scale(0.8333)">
        <Path d={ICON_PATHS[kind]} fill="none" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}
