// Touch controls for landscape play.
// - Left thumb zone: Left / Right arrows
// - Right thumb zone: Jump button
// Uses onPressIn / onPressOut for zero input delay and reports state up.

import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "./constants";

export interface ControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

interface Props {
  onChange: (s: ControlState) => void;
  paused?: boolean;
}

export function TouchControls({ onChange, paused }: Props) {
  const stateRef = useRef<ControlState>({ left: false, right: false, jump: false });
  const [_render, setRender] = useState(0);

  const emit = useCallback(() => {
    onChange({ ...stateRef.current });
    setRender((n) => (n + 1) % 1_000_000);
  }, [onChange]);

  const set = (k: keyof ControlState, v: boolean) => {
    stateRef.current[k] = v;
    emit();
  };

  const disabled = !!paused;

  return (
    <View style={styles.root} pointerEvents={disabled ? "none" : "auto"}>
      {/* Left cluster */}
      <View style={styles.leftCluster}>
        <Pressable
          testID="btn-left"
          onPressIn={() => set("left", true)}
          onPressOut={() => set("left", false)}
          style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnActive]}
          hitSlop={12}
        >
          <Text style={styles.padGlyph}>{"\u25C0"}</Text>
        </Pressable>
        <View style={{ width: 18 }} />
        <Pressable
          testID="btn-right"
          onPressIn={() => set("right", true)}
          onPressOut={() => set("right", false)}
          style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnActive]}
          hitSlop={12}
        >
          <Text style={styles.padGlyph}>{"\u25B6"}</Text>
        </Pressable>
      </View>

      {/* Right cluster - Jump */}
      <View style={styles.rightCluster}>
        <Pressable
          testID="btn-jump"
          onPressIn={() => set("jump", true)}
          onPressOut={() => set("jump", false)}
          style={({ pressed }) => [styles.jumpBtn, pressed && styles.jumpBtnActive]}
          hitSlop={12}
        >
          <Text style={styles.jumpLabel}>JUMP</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  leftCluster: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightCluster: {
    alignItems: "center",
    justifyContent: "center",
  },
  padBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(22, 24, 36, 0.75)",
    borderWidth: 1.5,
    borderColor: COLORS.borderGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  padBtnActive: {
    backgroundColor: "rgba(0, 229, 255, 0.25)",
    borderColor: COLORS.cyan,
  },
  padGlyph: {
    color: COLORS.cyan,
    fontSize: 26,
    fontWeight: "800",
  },
  jumpBtn: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(157, 0, 255, 0.18)",
    borderWidth: 2,
    borderColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  jumpBtnActive: {
    backgroundColor: "rgba(157, 0, 255, 0.45)",
  },
  jumpLabel: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
