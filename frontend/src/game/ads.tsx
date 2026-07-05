// Stubbed monetization UI. Real AdMob wiring happens pre-Play-Store release;
// for now these components are visible in the UI, register clicks, and
// no-op silently (or show a toast/log). They live behind `save.removeAds` so
// the flow is easy to test.

import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "./constants";
import { setRemoveAds } from "./save";

interface Props {
  removeAds: boolean;
  onChange?: (removeAds: boolean) => void;
}

export function AdsBar({ removeAds, onChange }: Props) {
  const [showModal, setShowModal] = useState<null | "rewarded" | "purchase">(null);

  return (
    <View style={styles.row}>
      <Pressable
        testID="btn-rewarded"
        onPress={() => setShowModal("rewarded")}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <Text style={styles.pillIcon}>{"\u25B6"}</Text>
        <Text style={styles.pillLabel}>WATCH AD</Text>
      </Pressable>

      {!removeAds ? (
        <Pressable
          testID="btn-remove-ads"
          onPress={() => setShowModal("purchase")}
          style={({ pressed }) => [styles.pill, styles.buyPill, pressed && styles.pillPressed]}
        >
          <Text style={[styles.pillIcon, { color: COLORS.purple }]}>{"\u2726"}</Text>
          <Text style={styles.pillLabel}>REMOVE ADS</Text>
        </Pressable>
      ) : (
        <View style={[styles.pill, styles.buyPill]}>
          <Text style={[styles.pillIcon, { color: COLORS.green }]}>{"\u2713"}</Text>
          <Text style={styles.pillLabel}>AD-FREE</Text>
        </View>
      )}

      <Modal transparent visible={showModal !== null} animationType="fade" onRequestClose={() => setShowModal(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {showModal === "rewarded" ? "Rewarded Ad" : "Remove Ads"}
            </Text>
            <Text style={styles.cardBody}>
              {showModal === "rewarded"
                ? "AdMob rewarded ads will be enabled in the release build. For now this is a stub."
                : "In-app purchases will be enabled in the release build. Tap Restore to preview the ad-free experience."}
            </Text>
            <View style={styles.cardActions}>
              <Pressable
                testID="btn-modal-close"
                style={({ pressed }) => [styles.cardBtn, pressed && styles.pillPressed]}
                onPress={() => setShowModal(null)}
              >
                <Text style={styles.cardBtnLabel}>Close</Text>
              </Pressable>
              {showModal === "purchase" ? (
                <Pressable
                  testID="btn-modal-restore"
                  style={({ pressed }) => [styles.cardBtn, styles.primaryBtn, pressed && styles.pillPressed]}
                  onPress={async () => {
                    await setRemoveAds(true);
                    onChange?.(true);
                    setShowModal(null);
                  }}
                >
                  <Text style={styles.cardBtnLabel}>Preview Ad-Free</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "rgba(22, 24, 36, 0.85)",
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
  },
  buyPill: {
    borderColor: "rgba(157, 0, 255, 0.5)",
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillIcon: {
    color: COLORS.cyan,
    fontSize: 14,
    fontWeight: "900",
  },
  pillLabel: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    padding: 20,
    maxWidth: 480,
    width: "100%",
  },
  cardTitle: {
    color: COLORS.cyan,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  cardBody: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cardBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  primaryBtn: {
    backgroundColor: "rgba(0, 229, 255, 0.18)",
    borderColor: COLORS.cyan,
  },
  cardBtnLabel: {
    color: COLORS.white,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
