// Settings: audio toggle, haptics toggle, reset save. Minimal but wired up.

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { setAudioEnabled } from "@/src/game/audio";
import { setHapticsEnabled } from "@/src/game/haptics";
import { COLORS } from "@/src/game/constants";
import {
  getCachedSave,
  loadSave,
  persistSave,
  setAudio,
  setHaptics,
  setOneThumb,
  setScreenShake,
} from "@/src/game/save";

export default function Settings() {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    loadSave().then(() => setTick((n) => n + 1));
  }, []);

  const save = getCachedSave();

  const toggleAudio = async () => {
    await setAudio(!save.audioOn);
    setAudioEnabled(!save.audioOn);
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

  const resetAll = async () => {
    const data = getCachedSave();
    for (const k of Object.keys(data.levels)) {
      data.levels[k] = { completed: false, bestEchoes: Infinity, grade: null, stars: 0 };
    }
    await persistSave(data);
    setTick((n) => n + 1);
  };

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

        <View style={styles.card}>
          <Row label="Audio" testID="row-audio">
            <Switch
              testID="switch-audio"
              value={save.audioOn}
              onValueChange={toggleAudio}
              thumbColor={save.audioOn ? COLORS.cyan : COLORS.textMuted}
              trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
            />
          </Row>
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
          <Row label="Screen shake" testID="row-shake">
            <Switch
              testID="switch-shake"
              value={save.screenShake}
              onValueChange={toggleShake}
              thumbColor={save.screenShake ? COLORS.cyan : COLORS.textMuted}
              trackColor={{ true: "rgba(0, 229, 255, 0.5)", false: "#2A2E3F" }}
            />
          </Row>
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
      </SafeAreaView>
    </View>
  );
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
    marginBottom: 24,
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
  card: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    marginBottom: 16,
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
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
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
  footer: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 3,
    textAlign: "center",
  },
  pressed: { opacity: 0.7 },
});
