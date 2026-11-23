import { Platform, Share } from 'react-native';
import { buildShareUrl, shareMessage, type SharedSpot } from './share';

export type ShareResult = 'shared' | 'copied' | 'failed';

/**
 * Opens the phone's share menu (WhatsApp, messages…) with a link to the spot. On a computer's
 * browser, which has no share menu, the message and link are copied instead.
 */
export async function shareSpot(spot: SharedSpot, sunsetClock: string, isTomorrow: boolean): Promise<ShareResult> {
  const url = buildShareUrl(spot);
  const text = shareMessage(spot, sunsetClock, isTomorrow);
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator;
      if (nav?.share) {
        await nav.share({ text, url });
        return 'shared';
      }
      await nav.clipboard.writeText(`${text}\n${url}`);
      return 'copied';
    }
    await Share.share({ message: `${text}\n${url}` });
    return 'shared';
  } catch (e) {
    // Closing the share menu without picking anyone isn't a failure.
    if (e instanceof Error && e.name === 'AbortError') return 'shared';
    return 'failed';
  }
}
