// Interstitial ads — shown AT level-complete transitions, never during
// gameplay. Random cadence (every 3-5 completed levels) prevents a
// predictable "ad after every level" annoyance.
//
// If the ad hasn't loaded within 10 s it is silently abandoned — the
// game proceeds to the next level without blocking.

import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";

import { areAdsReady } from "./bootstrap";
import { adUnitIds, adsSupported } from "./config";

let completedSinceAd = 0;
let nextThreshold = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5

/** Call after a level is successfully completed and the result committed. */
export function onLevelCompleted(): void {
  completedSinceAd += 1;
  if (!adsSupported || !areAdsReady()) return;
  if (completedSinceAd < nextThreshold) return;

  // Reset the cadence BEFORE requesting — if the request fails we don't
  // retry on the next level, we just wait another 3-5 completes.
  completedSinceAd = 0;
  nextThreshold = 3 + Math.floor(Math.random() * 3);

  const ad = InterstitialAd.createForAdRequest(adUnitIds.interstitial);
  let loaded = false;
  let settled = false;

  const cleanup = () => {
    if (settled) return;
    settled = true;
    offLoaded();
    offError();
    offClosed();
  };

  const offLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
    try {
      ad.show();
    } catch (err) {
      if (__DEV__) console.warn("[interstitial] show failed", err);
      cleanup();
    }
  });
  const offError = ad.addAdEventListener(AdEventType.ERROR, (err) => {
    if (__DEV__) console.warn("[interstitial] error", err);
    cleanup();
  });
  const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
    cleanup();
  });

  ad.load();

  setTimeout(() => {
    if (!loaded) cleanup();
  }, 10000);
}
