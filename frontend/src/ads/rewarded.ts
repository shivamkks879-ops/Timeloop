// Rewarded ads — "Watch ad to continue / get a hint".
//
// Flow:
//   1. User explicitly taps "Watch Ad" on the death screen.
//   2. We build a NEW RewardedAd (fresh request = fewer stale-ad bugs).
//   3. On LOADED we show it.
//   4. On EARNED_REWARD we fire `onReward()` — only grant reward here.
//   5. On ERROR before load we fire `onUnavailable()` — normal retry.
//   6. On CLOSED without reward we fire `onUnavailable()`.
//
// The game NEVER waits for an ad — if the ad never loads within ~8 s we
// treat it as unavailable and let the player retry normally.

import { RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";
import { adUnitIds, adsSupported } from "./config";
import { areAdsReady } from "./bootstrap";

export type RewardKind = "continue" | "hint";

export function showRewarded(
  kind: RewardKind,
  onReward: () => void,
  onUnavailable: () => void,
) {
  if (!adsSupported || !areAdsReady()) {
    onUnavailable();
    return;
  }

  let loaded = false;
  let rewarded = false;
  let settled = false;
  const settle = (cb: () => void) => {
    if (settled) return;
    settled = true;
    cb();
  };

  const ad = RewardedAd.createForAdRequest(adUnitIds.rewarded, {
    serverSideVerificationOptions: {
      // We don't need a stable user ID for a local reward — any unique
      // string works and keeps SSV traffic correlated.
      userId: `anon-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      customData: kind,
    },
  });

  const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    loaded = true;
    try {
      ad.show();
    } catch (err) {
      if (__DEV__) console.warn("[rewarded] show failed", err);
      settle(onUnavailable);
    }
  });
  const offEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    rewarded = true;
    settle(onReward);
  });
  const offError = ad.addAdEventListener("error" as any, (err: unknown) => {
    if (__DEV__) console.warn("[rewarded] error", err);
    if (!loaded) settle(onUnavailable);
  });
  const offClosed = ad.addAdEventListener("closed" as any, () => {
    offLoaded();
    offEarned();
    offError();
    offClosed();
    if (!rewarded) settle(onUnavailable);
  });

  ad.load();

  // Belt-and-braces: if the ad never loads in 8s, treat as unavailable.
  setTimeout(() => {
    if (!loaded) {
      offLoaded();
      offEarned();
      offError();
      offClosed();
      settle(onUnavailable);
    }
  }, 8000);
}
