// Touch controls for landscape play.
//
// - Standard mode: LEFT/RIGHT on the left thumb zone, JUMP on the right.
// - One-thumb mode: All three buttons stacked on the LEFT side so the
//   entire input surface is reachable from a single thumb (great for
//   commuting / propped-up landscape play).
//
// Uses onPressIn / onPressOut for zero input delay and reports state up.
// Dead zones are enlarged via a generous `hitSlop` so users don't miss a
// button by a pixel — critical for a game where a single frame can matter.

import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "./constants";
import { haptic } from "./haptics";

export interface ControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

interface Props {
  onChange: (s: ControlState) => void;
  paused?: boolean;
  oneThumb?: boolean;
}

export function TouchControls({ onChange, paused, oneThumb }: Props) {
  const stateRef = useRef<ControlState>({ left: false, right: false, jump: false });
  const [_render, setRender] = useState(0);

  const emit = useCallback(() => {
    onChange({ ...stateRef.current });
    setRender((n) => (n + 1) % 1_000_000);
  }, [onChange]);

  const set = (k: keyof ControlState, v: boolean) => {
    stateRef.current[k] = v;
    if (v) haptic("ui");
    emit();
  };

  const disabled = !!paused;

  // Enlarged hit-slop = each button reads presses from a much wider area
  // than the visible glyph. This dramatically reduces missed inputs.
  const dpadSlop = { top: 22, bottom: 22, left: 22, right: 22 };
  const jumpSlop = { top: 24, bottom: 24, left: 24, right: 24 };

  if (oneThumb) {
    // Single-thumb layout: [LEFT] [JUMP] [RIGHT] stacked on the left edge.
    // The three buttons are close together so the same thumb can hop
    // between them without lifting off the screen.
    return (
      <View style={styles.root} pointerEvents={disabled ? "none" : "auto"}>
        <View style={styles.oneThumbCluster}>
          <Pressable
            testID="btn-left"
            onPressIn={() => set("left", true)}
            onPressOut={() => set("left", false)}
            style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnActive]}
            hitSlop={dpadSlop}
          >
            <Text style={styles.padGlyph}>{"\u25C0"}</Text>
          </Pressable>
          <View style={{ width: 10 }} />
          <Pressable
            testID="btn-jump"
            onPressIn={() => set("jump", true)}
            onPressOut={() => set("jump", false)}
            style={({ pressed }) => [styles.jumpBtnSmall, pressed && styles.jumpBtnActive]}
            hitSlop={jumpSlop}
          >
            <Text style={styles.jumpLabelSmall}>JUMP</Text>
          </Pressable>
          <View style={{ width: 10 }} />
          <Pressable
            testID="btn-right"
            onPressIn={() => set("right", true)}
            onPressOut={() => set("right", false)}
            style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnActive]}
            hitSlop={dpadSlop}
          >
            <Text style={styles.padGlyph}>{"\u25B6"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents={disabled ? "none" : "auto"}>
      {/* Left cluster */}
      <View style={styles.leftCluster}>
        <Pressable
          testID="btn-left"
          onPressIn={() => set("left", true)}
          onPressOut={() => set("left", false)}
          style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnActive]}
          hitSlop={dpadSlop}
        >
          <Text style={styles.padGlyph}>{"\u25C0"}</Text>
        </Pressable>
        <View style={{ width: 18 }} />
        <Pressable
          testID="btn-right"
          onPressIn={() => set("right", true)}
          onPressOut={() => set("right", false)}
          style={({ pressed }) => [styles.padBtn, pressed && styles.padBtnActive]}
          hitSlop={dpadSlop}
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
          hitSlop={jumpSlop}
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
  oneThumbCluster: {
    flexDirection: "row",
    alignItems: "center",
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
  jumpBtnSmall: {
    width: 76,
    height: 76,
    borderRadius: 38,
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
  jumpLabelSmall: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
