// AdMob + UMP consent bootstrap.
//
// Called once from the root layout. It:
//   1. Checks the previous session's stored consent (`canRequestAds`).
//   2. If consent is still required (EEA / UK users on their first launch),
//      shows the UMP consent form that was published in the AdMob console.
//   3. Initialises the Google Mobile Ads SDK only AFTER consent is granted.
//
// Everything is wrapped in a top-level try/catch so a consent failure or
// a network issue NEVER prevents the game from starting. If `startAds`
// returns false, no ad helpers will attempt to show anything — the game
// stays fully playable without ads.

import { Platform } from "react-native";
import mobileAds, { AdsConsent } from "react-native-google-mobile-ads";

import { adsSupported } from "./config";

let started = false;

export function areAdsReady(): boolean {
  return started;
}

export async function startAds(): Promise<boolean> {
  if (!adsSupported || started || Platform.OS !== "android") return false;

  try {
    const before = await AdsConsent.getConsentInfo();
    if (before.canRequestAds) {
      await mobileAds().initialize();
      started = true;
      return true;
    }

    await AdsConsent.gatherConsent();
    const after = await AdsConsent.getConsentInfo();
    if (!after.canRequestAds) return false;

    await mobileAds().initialize();
    started = true;
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[ads] bootstrap failed", err);
    // Game continues without ads.
    return false;
  }
}

/** Expose a "Privacy options" entry point for Settings screens. Only
 *  shows the form if the user previously consented in a region that
 *  allows withdrawing consent. Safe to call anytime. */
export async function showPrivacyOptions(): Promise<void> {
  if (!adsSupported) return;
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch (err) {
    if (__DEV__) console.warn("[ads] privacy options failed", err);
  }
}
