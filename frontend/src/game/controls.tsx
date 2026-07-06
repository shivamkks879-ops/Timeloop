// Touch controls for landscape play.
//
// - Standard mode: LEFT/RIGHT on the left thumb zone, JUMP on the right.
// - One-thumb mode: All three buttons stacked on the LEFT side so the
//   entire input surface is reachable from a single thumb.
//
// Multi-touch:
//   Each Pressable owns its own touch stream on Android/iOS so the user can
//   hold LEFT and tap JUMP simultaneously without either losing state. We
//   deliberately avoid triggering a React re-render of the whole controls
//   overlay when a button is pressed — Pressable's own `pressed` state
//   already handles the visual feedback, and forcing a parent re-render was
//   observed to occasionally cancel a concurrent touch on some devices.

import React, { useCallback, useRef } from "react";
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
  opacity?: number;   // 0.4 – 1.0 (default 0.85). Applied to whole overlay.
}

export function TouchControls({ onChange, paused, oneThumb, opacity }: Props) {
  const stateRef = useRef<ControlState>({ left: false, right: false, jump: false });

  const set = useCallback(
    (k: keyof ControlState, v: boolean) => {
      stateRef.current[k] = v;
      if (v) haptic("ui");
      // Notify parent — game loop reads this at 60Hz via its own ref.
      // Intentionally NOT calling any local setState here so this component
      // never re-renders on button press; that keeps multi-touch streams
      // isolated on Android and eliminates a wasted 60Hz React reconcile.
      onChange({ ...stateRef.current });
    },
    [onChange],
  );

  const disabled = !!paused;
  const alpha = typeof opacity === "number" ? Math.max(0.4, Math.min(1, opacity)) : 0.85;

  // Enlarged hit-slop = each button reads presses from a much wider area
  // than the visible glyph. This dramatically reduces missed inputs.
  const dpadSlop = { top: 22, bottom: 22, left: 22, right: 22 };
  const jumpSlop = { top: 20, bottom: 20, left: 20, right: 20 };

  if (oneThumb) {
    return (
      <View style={[styles.root, { opacity: alpha }]} pointerEvents={disabled ? "none" : "box-none"}>
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
            style={({ pressed }) => [styles.jumpBtn, pressed && styles.jumpBtnActive]}
            hitSlop={jumpSlop}
          >
            <Text style={styles.jumpLabel}>JUMP</Text>
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
    <View style={[styles.root, { opacity: alpha }]} pointerEvents={disabled ? "none" : "box-none"}>
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
    paddingBottom: 22,
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
    width: 66,
    height: 66,
    borderRadius: 33,
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
    fontSize: 24,
    fontWeight: "800",
  },
  jumpBtn: {
    // Smaller than before (was 92) — no longer visually dominates the HUD,
    // still comfortably thumb-sized with generous hitSlop underneath.
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(157, 0, 255, 0.20)",
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
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
