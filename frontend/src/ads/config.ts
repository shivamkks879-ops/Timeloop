// AdMob ad-unit configuration.
//
// We ALWAYS use Google's dedicated Android test IDs when `__DEV__` is true,
// and the real production IDs when running a release build. Google's
// policies forbid using production IDs in development — doing so will
// get the AdMob account suspended for invalid traffic.
//
// 🔴 TO FINISH PRODUCTION SETUP:
//   Replace the three strings below marked `REPLACE_WITH_PRODUCTION_*`
//   with the ad-unit IDs you create in your AdMob console under the
//   `com.timeloopscope.game` app:
//     Rewarded    → single rewarded unit (continue after death / hint)
//     Interstitial → single interstitial unit (every 3-5 level completes)
//     Banner      → single anchored adaptive banner (menu & level-select)
//
// The Android App ID itself lives in `app.json` under
// `plugins → react-native-google-mobile-ads → androidAppId` and is also
// placeholder-filled with the Google test App ID right now.
//
// Nothing in this file is a secret — ad-unit IDs are safe to ship in the
// client bundle.

import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const production = {
  rewarded: "REPLACE_WITH_PRODUCTION_REWARDED_UNIT_ID",
  interstitial: "REPLACE_WITH_PRODUCTION_INTERSTITIAL_UNIT_ID",
  banner: "REPLACE_WITH_PRODUCTION_BANNER_UNIT_ID",
};

export const adUnitIds = {
  rewarded: __DEV__ ? TestIds.REWARDED : production.rewarded,
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : production.interstitial,
  banner: __DEV__ ? TestIds.BANNER : production.banner,
};

// Ads are Android-only in this project. On iOS / web the helpers return
// gracefully without ever referencing the native module.
export const adsSupported = Platform.OS === "android";
