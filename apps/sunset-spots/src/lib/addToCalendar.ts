/**
 * Hands the sunset calendar file (see ics.ts) to the user's calendar, on the web, with no
 * permissions and no server: nothing is uploaded, the file goes from the page to the device.
 *
 * Download first (F1d research): iPhone Safari opens it as a calendar preview with "Add All" and
 * Apple Calendar keeps the alerts; Samsung Calendar and desktop calendars open the download too.
 * The share sheet is only a fallback, because on iPhone it tends to offer "Save to Files" instead
 * of the calendar. Native app builds get 'unsupported' for now (in-app notifications are F2).
 *
 * No react-native import on purpose: the web check is "is there a DOM", which a native build
 * doesn't have, and it keeps this testable in Node with a fake environment.
 */

export type AddToCalendarResult = 'downloaded' | 'shared' | 'cancelled' | 'unsupported' | 'failed';

export const ICS_FILE_NAME = 'sunset.ics';
const ICS_TYPE = 'text/calendar';
/** 31 short events are ~15 KB; anything far bigger isn't ours. */
const MAX_ICS_CHARS = 200_000;
/** Revoking the object URL right after click() breaks the download in Safari and Firefox. */
const REVOKE_AFTER_MS = 10_000;

type AnchorLike = {
  href: string;
  download: string;
  rel: string;
  style: { display: string };
  click(): void;
};

export type WebEnv = {
  document: {
    createElement(tag: 'a'): AnchorLike;
    body: { appendChild(node: AnchorLike): unknown; removeChild(node: AnchorLike): unknown };
  };
  URL: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
  navigator?: {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  setTimeout(fn: () => void, ms: number): unknown;
};

/** The browser's environment, or null where there is no DOM to download with (native builds). */
export function webEnv(): WebEnv | null {
  const g = globalThis as unknown as Partial<WebEnv>;
  if (typeof g.document?.createElement !== 'function' || !g.document.body) return null;
  if (typeof g.URL?.createObjectURL !== 'function' || typeof Blob !== 'function') return null;
  return {
    document: g.document,
    URL: g.URL,
    navigator: g.navigator,
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  };
}

/** Synchronous on purpose: the click must happen inside the user's tap. */
function download(ics: string, env: WebEnv): boolean {
  let url: string | null = null;
  try {
    const a = env.document.createElement('a');
    if (!('download' in a)) return false; // a browser that would navigate instead of saving
    url = env.URL.createObjectURL(new Blob([ics], { type: ICS_TYPE }));
    a.href = url;
    a.download = ICS_FILE_NAME;
    a.rel = 'noopener';
    a.style.display = 'none';
    env.document.body.appendChild(a);
    try {
      a.click();
    } finally {
      env.document.body.removeChild(a);
    }
    const done = url;
    env.setTimeout(() => env.URL.revokeObjectURL(done), REVOKE_AFTER_MS);
    return true;
  } catch {
    if (url) env.URL.revokeObjectURL(url);
    return false;
  }
}

async function share(ics: string, env: WebEnv): Promise<AddToCalendarResult> {
  const nav = env.navigator;
  if (typeof File !== 'function' || !nav?.share || !nav.canShare) return 'failed';
  try {
    const file = new File([ics], ICS_FILE_NAME, { type: ICS_TYPE });
    if (!nav.canShare({ files: [file] })) return 'failed';
    await nav.share({ files: [file] });
    return 'shared';
  } catch (e) {
    // Closing the share menu without picking anything isn't a failure.
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

/** Download the file; if this browser can't, offer it through the share menu. */
export async function addToCalendar(ics: string, env: WebEnv | null = webEnv()): Promise<AddToCalendarResult> {
  if (!env) return 'unsupported';
  if (typeof ics !== 'string' || ics.length === 0 || ics.length > MAX_ICS_CHARS) return 'failed';
  if (download(ics, env)) return 'downloaded';
  return share(ics, env);
}
