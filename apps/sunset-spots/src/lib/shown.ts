import { isMine } from './myspots.ts';
import type { ScoredSpot } from './score.ts';
import type { ShownSpot } from './travel.ts';

/**
 * What the main screen shows, split out so it can be worked out once instead of every second.
 * The ranking only depends on where you are and the spots; the "in time" colours on the clock,
 * and that clock only needs to move once a minute.
 */

/** How many of the best spots are shown, before your own ones further down. */
export const SHORTLIST = 6;

/** Start of the current minute, in ms: the key the reach colours are recomputed on. */
export function minuteOf(now: Date): number {
  return Math.floor(now.getTime() / 60000) * 60000;
}

/**
 * The time the reach colours are worked out for: the end of the minute (from minuteOf). Erring late,
 * a spot can turn "late" up to a minute early, but never says "in time" once you'd miss it.
 */
export function reachClock(minute: number): Date {
  return new Date(minute + 60000);
}

/** The top spots, plus any of your own that ranked further down (in score order). */
export function shortlist<T extends ScoredSpot>(scored: T[], top = SHORTLIST): T[] {
  const best = scored.slice(0, top);
  const moreOfMine = scored.filter((s) => isMine(s) && !best.includes(s));
  return [...best, ...moreOfMine];
}

/** The pins on the map: the list, plus the shared spot and the selected one when they aren't in it. */
export function mapSpotsFor(ranked: ShownSpot[] | null, shared: ShownSpot | null, selected: ShownSpot | null): ShownSpot[] {
  const out = [...(ranked ?? [])];
  for (const extra of [shared, selected]) {
    if (extra && !out.some((s) => s.id === extra.id)) out.push(extra);
  }
  return out;
}
