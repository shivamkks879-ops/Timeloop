// Settings: audio (music+sfx), haptics, controls, accessibility, reset save.

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { setMusicEnabled, setSfxEnabled, startMusic, stopMusic } from "@/src/game/audio";
import { setHapticsEnabled } from "@/src/game/haptics";
import { COLORS } from "@/src/game/constants";
import {
  getCachedSave,
  loadSave,
  persistSave,
  setColorSafe,
  setControlOpacity,
  setHaptics,
  setMusicOn,
  setOneThumb,
  setScreenShake,
  setSfxOn,
} from "@/src/game/save";

export default function Settings() {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    loadSave().then(() => setTick((n) => n + 1));
  }, []);

  const save = getCachedSave();

  const toggleMusic = async () => {
    const next = !save.musicOn;
    await setMusicOn(next);
    setMusicEnabled(next);
    if (next) startMusic();
    else stopMusic();
    setTick((n) => n + 1);
  };
  const toggleSfx = async () => {
    const next = !save.sfxOn;
    await setSfxOn(next);
    setSfxEnabled(next);
    setTick((n) => n + 1);
  };
  const toggleHaptics = async () => {
    const next = !save.hapticsOn;
    await setHaptics(next);
    setHapticsEnabled(next);
    setTick((n) => n + 1);
  };
  const toggleOneThumb = async () => {
    await setOneThumb(!save.oneThumb);
    setTick((n) => n + 1);
  };
  const toggleShake = async () => {
    await setScreenShake(!save.screenShake);
    setTick((n) => n + 1);
  };
  const toggleColorSafe = async () => {
    await setColorSafe(!save.colorSafe);
    setTick((n) => n + 1);
  };

  const bumpOpacity = async (delta: number) => {
    const next = Math.max(0.4, Math.min(1, (save.controlOpacity ?? 0.85) + delta));
    await setControlOpacity(next);
    setTick((n) => n + 1);
  };

  const resetAll = async () => {
    const data = getCachedSave();
    for (const k of Object.keys(data.levels)) {
      data.levels[k] = { completed: false, bestEchoes: Infinity, grade: null, stars: 0 };
    }
    await persistSave(data);
    setTick((n) => n + 1);
  };

  const opacityPct = Math.round((save.controlOpacity ?? 0.85) * 100);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            testID="btn-back"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backLabel}>{"\u2039"} BACK</Text>
          </Pressable>
          <Text style={styles.title}>SETTINGS</Text>
          <View style={{ width: 88 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <SectionHeader label="AUDIO" />
          <View style={styles.card}>
            <Row label="Music" testID="row-music">
              <Switch
                testID="switch-music"
                value={save.musicOn}
                onValueChange={toggleMusic}
                thumbColor={save.musicOn ? COLORS.cyan : COLORS.textMuted}
                trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
              />
            </Row>
            <Row label="Sound effects" testID="row-sfx">
              <Switch
                testID="switch-sfx"
                value={save.sfxOn}
                onValueChange={toggleSfx}
                thumbColor={save.sfxOn ? COLORS.cyan : COLORS.textMuted}
                trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
              />
            </Row>
          </View>

          <SectionHeader label="CONTROLS" />
          <View style={styles.card}>
            <Row label="Haptics" testID="row-haptics">
              <Switch
                testID="switch-haptics"
                value={save.hapticsOn}
                onValueChange={toggleHaptics}
                thumbColor={save.hapticsOn ? COLORS.cyan : COLORS.textMuted}
                trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
              />
            </Row>
            <Row label="One-thumb mode" testID="row-onethumb">
              <Switch
                testID="switch-onethumb"
                value={save.oneThumb}
                onValueChange={toggleOneThumb}
                thumbColor={save.oneThumb ? COLORS.cyan : COLORS.textMuted}
                trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
              />
            </Row>
            <Row label={`Button opacity — ${opacityPct}%`} testID="row-opacity">
              <View style={styles.stepper}>
                <Pressable
                  testID="opacity-minus"
                  onPress={() => bumpOpacity(-0.1)}
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.stepGlyph}>{"\u2212"}</Text>
                </Pressable>
                <View style={styles.opacityTrack}>
                  <View
                    style={[
                      styles.opacityFill,
                      { width: `${((opacityPct - 40) / 60) * 100}%` },
                    ]}
                  />
                </View>
                <Pressable
                  testID="opacity-plus"
                  onPress={() => bumpOpacity(0.1)}
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.stepGlyph}>{"+"}</Text>
                </Pressable>
              </View>
            </Row>
          </View>

          <SectionHeader label="VISUALS & ACCESSIBILITY" />
          <View style={styles.card}>
            <Row label="Screen shake" testID="row-shake">
              <Switch
                testID="switch-shake"
                value={save.screenShake}
                onValueChange={toggleShake}
                thumbColor={save.screenShake ? COLORS.cyan : COLORS.textMuted}
                trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
              />
            </Row>
            <Row label="Colorblind-safe palette" testID="row-colorsafe">
              <Switch
                testID="switch-colorsafe"
                value={save.colorSafe}
                onValueChange={toggleColorSafe}
                thumbColor={save.colorSafe ? COLORS.cyan : COLORS.textMuted}
                trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
              />
            </Row>
          </View>

          <SectionHeader label="DATA" />
          <View style={styles.card}>
            <Row label="Progress" testID="row-reset">
              <Pressable
                testID="btn-reset"
                style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
                onPress={resetAll}
              >
                <Text style={styles.resetLabel}>RESET</Text>
              </Pressable>
            </Row>
          </View>

          <Text style={styles.footer}>
            v1.0.0 · 100 LEVELS · Built with Expo + Skia
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function Row({ label, testID, children }: { label: string; testID: string; children: React.ReactNode }) {
  return (
    <View testID={testID} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1, padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    backgroundColor: "rgba(22, 24, 36, 0.85)",
  },
  backLabel: {
    color: COLORS.cyan,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 6,
  },
  sectionHeader: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    marginTop: 10,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomColor: "rgba(255,255,255,0.05)",
    borderBottomWidth: 1,
  },
  rowLabel: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 2,
    flex: 1,
  },
  resetBtn: {
    borderColor: COLORS.red,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resetLabel: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    borderWidth: 1,
    borderColor: COLORS.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  stepGlyph: {
    color: COLORS.cyan,
    fontSize: 18,
    fontWeight: "900",
  },
  opacityTrack: {
    width: 60,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  opacityFill: {
    height: "100%",
    backgroundColor: COLORS.cyan,
  },
  footer: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 20,
  },
  pressed: { opacity: 0.7 },
});
