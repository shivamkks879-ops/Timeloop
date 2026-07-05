// HUD overlay: timer, echo counter, pause, restart.
// Uses standard RN components (not Skia) so labels are crisp text.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, SIM } from "./constants";

interface Props {
  timeSec: number;
  loop: number;
  maxEchoes: number;
  onPause: () => void;
  onRestart: () => void;
  levelName: string;
}

export function HUD({ timeSec, loop, maxEchoes, onPause, onRestart, levelName }: Props) {
  const low = timeSec <= 3;
  const timeStr = timeSec.toFixed(2);
  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Top bar */}
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          <Pressable
            testID="btn-pause"
            onPress={onPause}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          >
            <Text style={styles.iconTxt}>{"\u23F8"}</Text>
          </Pressable>
          <View style={styles.echoPill}>
            <View style={styles.echoDot} />
            <Text style={styles.echoLabel}>
              ECHO {loop}/{maxEchoes}
            </Text>
          </View>
        </View>

        <View style={styles.centerGroup} pointerEvents="none">
          <Text style={styles.levelName}>{levelName.toUpperCase()}</Text>
          <Text
            testID="hud-timer"
            style={[styles.timer, low && styles.timerLow]}
          >
            {timeStr}s
          </Text>
        </View>

        <View style={styles.rightGroup}>
          <Pressable
            testID="btn-restart"
            onPress={onRestart}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          >
            <Text style={styles.iconTxt}>{"\u21BA"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Fetch loop total in seconds for HUD (kept for future scaling).
export const LOOP_SEC = SIM.LOOP_TICKS / SIM.TPS;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  centerGroup: {
    alignItems: "center",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(22, 24, 36, 0.8)",
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPressed: {
    backgroundColor: "rgba(0, 229, 255, 0.2)",
  },
  iconTxt: {
    color: COLORS.cyan,
    fontSize: 20,
    fontWeight: "800",
  },
  echoPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 24, 36, 0.8)",
    borderColor: COLORS.purple,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  echoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.purple,
  },
  echoLabel: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  levelName: {
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 2,
  },
  timer: {
    color: COLORS.cyan,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2,
    textShadowColor: COLORS.cyan,
    textShadowRadius: 12,
  },
  timerLow: {
    color: COLORS.red,
    textShadowColor: COLORS.red,
  },
});
