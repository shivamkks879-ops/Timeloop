// Banner ad — anchored adaptive banner, only mounted on menu-like
// screens (home, level-select, results). NEVER render in gameplay or
// over game controls.

import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

import { adUnitIds, adsSupported } from "../ads/config";

/** Reserves vertical space whether or not the banner loads so layout
 *  doesn't jump when ads arrive. Safe to render on web/iOS (returns a
 *  spacer only). */
export function MenuBanner() {
  if (!adsSupported || Platform.OS !== "android") {
    return <View style={styles.wrap} />;
  }
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={adUnitIds.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(err) => {
          if (__DEV__) console.warn("[banner] load failed", err);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
