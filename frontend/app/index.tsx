// Main menu screen: Play (jumps to first uncompleted level), Level Select,
// Settings, and the stubbed ads bar.

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdsBar } from "@/src/game/ads";
import { COLORS } from "@/src/game/constants";
import { LEVELS } from "@/src/game/levels";
import { getCachedSave, loadSave } from "@/src/game/save";

export default function MainMenu() {
  const router = useRouter();
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSave().then(() => {
      setReady(true);
      setTick((t) => t + 1);
    });
  }, []);

  const save = getCachedSave();
  const nextLevel = LEVELS.find((l) => !save.levels[l.id]?.completed) ?? LEVELS[0];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0A0B10", "#141833", "#0A0B10"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Text style={styles.tagline}>PUZZLE PLATFORMER</Text>
            <Text style={styles.title}>TIME LOOP</Text>
            <Text style={styles.titleAccent}>ESCAPE</Text>
            <View style={styles.underline} />
          </View>

          <View style={styles.actions}>
            <Pressable
              testID="btn-play"
              onPress={() => router.push(`/game/${nextLevel.id}` as any)}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.primaryLabel}>{save.levels[LEVELS[0].id]?.completed ? "CONTINUE" : "PLAY"}</Text>
              <Text style={styles.primarySub}>Level {nextLevel.id} · {nextLevel.name}</Text>
            </Pressable>
            <Pressable
              testID="btn-levels"
              onPress={() => router.push("/levels" as any)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.secondaryLabel}>LEVEL SELECT</Text>
            </Pressable>
            <Pressable
              testID="btn-settings"
              onPress={() => router.push("/settings" as any)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.secondaryLabel}>SETTINGS</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>WORLD 1 · LEARNING TIME · 5 LEVELS</Text>
          {ready ? <AdsBar removeAds={save.removeAds} onChange={() => setTick((t) => t + 1)} /> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1, padding: 24 },
  content: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 32 },
  brand: { flex: 1 },
  tagline: {
    color: COLORS.cyan,
    fontSize: 12,
    letterSpacing: 6,
    fontWeight: "700",
    marginBottom: 12,
  },
  title: {
    color: COLORS.white,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: 2,
    lineHeight: 60,
  },
  titleAccent: {
    color: COLORS.cyan,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: 2,
    lineHeight: 60,
    textShadowColor: COLORS.cyan,
    textShadowRadius: 14,
  },
  underline: {
    marginTop: 18,
    width: 96,
    height: 3,
    backgroundColor: COLORS.purple,
    borderRadius: 2,
  },
  actions: {
    minWidth: 280,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    borderColor: COLORS.cyan,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 22,
  },
  primaryLabel: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
  },
  primarySub: {
    color: COLORS.textSecondary,
    marginTop: 4,
    fontSize: 12,
    letterSpacing: 1,
  },
  secondaryBtn: {
    backgroundColor: "rgba(22, 24, 36, 0.85)",
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  secondaryLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 3,
  },
  btnPressed: {
    opacity: 0.7,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 3,
  },
});
