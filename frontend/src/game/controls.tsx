// Touch controls — per-button `Pressable` for maximum reliability.
//
// Architecture:
//   Each control button is an independent `Pressable`. React Native's
//   PressResponder handles the touch lifecycle per-view, which means:
//     • `onPressIn`  → guaranteed to fire when a finger lands on the button
//     • `onPressOut` → guaranteed to fire when the finger lifts OR the OS
//                      terminates the responder (system gesture, modal open,
//                      app backgrounded). This is what killed the classic
//                      "auto-walk" bug — no manual touch-identifier tracking
//                      needed.
//     • Each button is its own responder, so multi-touch (LEFT + JUMP
//       together) works naturally — RN routes each finger to whichever
//       Pressable it touched.
//
// The root wrapper uses `pointerEvents="box-none"` so:
//   • Empty areas between buttons DO NOT capture touches → HUD (pause /
//     restart) remains accessible above.
//   • The game canvas below still receives no touches (it doesn't listen),
//     but that's fine — we don't need to steal them.
//
// Safety nets:
//   1. `AppState` listener — if the app is backgrounded (call, notification,
//      home button), we forcibly release every button so nothing is stuck
//      when the user returns.
//   2. `disabled` prop (pause / outcome overlay open) — clears state via
//      an effect so no button remains latched behind a modal.
//   3. `hitSlop` — 24 px expansion on every button so a slightly-off tap
//      still registers (kind to fat thumbs).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

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
  opacity?: number; // 0.4 – 1.0 (default 0.85). Applied to whole overlay.
}

type ButtonId = "left" | "right" | "jump";

export function TouchControls({ onChange, paused, oneThumb, opacity }: Props) {
  const stateRef = useRef<ControlState>({ left: false, right: false, jump: false });
  const [pressed, setPressed] = useState<Record<ButtonId, boolean>>({
    left: false,
    right: false,
    jump: false,
  });

  const disabled = !!paused;
  const alpha = typeof opacity === "number" ? Math.max(0.4, Math.min(1, opacity)) : 0.85;

  // Keep the latest onChange in a ref so setBtn doesn't need to be
  // memoized against it (prevents Pressable prop-churn re-renders).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const setBtn = useCallback((id: ButtonId, v: boolean) => {
    if (stateRef.current[id] === v) return;
    stateRef.current[id] = v;
    if (v) haptic("ui");
    onChangeRef.current({ ...stateRef.current });
    setPressed((p) => (p[id] === v ? p : { ...p, [id]: v }));
  }, []);

  const releaseAll = useCallback(() => {
    let dirty = false;
    for (const id of ["left", "right", "jump"] as const) {
      if (stateRef.current[id]) {
        stateRef.current[id] = false;
        dirty = true;
      }
    }
    if (dirty) {
      onChangeRef.current({ ...stateRef.current });
      setPressed({ left: false, right: false, jump: false });
    }
  }, []);

  // Reset when paused / outcome overlay opens — otherwise a button pressed
  // at the moment of pause would remain latched behind the modal.
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  // AppState safety net: if the OS pulls the app to background (call,
  // notification, home swipe), release every button. This kills the last
  // possible source of a stuck-input bug because pressOut is guaranteed
  // to fire on background transition on every RN version we've tested,
  // but this belt-and-braces reset costs nothing.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") releaseAll();
    });
    return () => sub.remove();
  }, [releaseAll]);

  const makeHandlers = (id: ButtonId) => ({
    onPressIn: () => {
      if (disabled) return;
      setBtn(id, true);
    },
    onPressOut: () => setBtn(id, false),
    // Fire pressIn immediately — no ripple / long-press delay. Critical
    // for a precision platformer where the frame you tap JUMP matters.
    unstable_pressDelay: 0,
    android_disableSound: true,
    android_ripple: null,
  });

  if (oneThumb) {
    // Compact single-thumb layout: JUMP on top, LEFT/RIGHT below — all in
    // the bottom-left corner, sized so a single thumb can reach every
    // button without sliding. Mimics a Game Boy style D-pad + face button.
    return (
      <View style={[styles.root, { opacity: alpha }]} pointerEvents="box-none">
        <View style={styles.oneThumbCluster} pointerEvents="box-none">
          {/* Top row: JUMP centred over the D-pad */}
          <Pressable
            testID="btn-jump"
            hitSlop={24}
            {...makeHandlers("jump")}
            style={({ pressed: p }) => [
              styles.oneThumbJump,
              (p || pressed.jump) && styles.jumpBtnActive,
            ]}
          >
            <Text style={styles.oneThumbJumpLabel}>JUMP</Text>
          </Pressable>
          {/* Bottom row: LEFT + RIGHT */}
          <View style={styles.oneThumbRow} pointerEvents="box-none">
            <Pressable
              testID="btn-left"
              hitSlop={26}
              {...makeHandlers("left")}
              style={({ pressed: p }) => [
                styles.oneThumbPad,
                (p || pressed.left) && styles.padBtnActive,
              ]}
            >
              <Text style={styles.padGlyph}>{"\u25C0"}</Text>
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable
              testID="btn-right"
              hitSlop={26}
              {...makeHandlers("right")}
              style={({ pressed: p }) => [
                styles.oneThumbPad,
                (p || pressed.right) && styles.padBtnActive,
              ]}
            >
              <Text style={styles.padGlyph}>{"\u25B6"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { opacity: alpha }]} pointerEvents="box-none">
      <View style={styles.leftCluster} pointerEvents="box-none">
        <Pressable
          testID="btn-left"
          hitSlop={24}
          {...makeHandlers("left")}
          style={({ pressed: p }) => [
            styles.padBtn,
            (p || pressed.left) && styles.padBtnActive,
          ]}
        >
          <Text style={styles.padGlyph}>{"\u25C0"}</Text>
        </Pressable>
        <View style={{ width: 18 }} />
        <Pressable
          testID="btn-right"
          hitSlop={24}
          {...makeHandlers("right")}
          style={({ pressed: p }) => [
            styles.padBtn,
            (p || pressed.right) && styles.padBtnActive,
          ]}
        >
          <Text style={styles.padGlyph}>{"\u25B6"}</Text>
        </Pressable>
      </View>

      <View style={styles.rightCluster} pointerEvents="box-none">
        <Pressable
          testID="btn-jump"
          hitSlop={22}
          {...makeHandlers("jump")}
          style={({ pressed: p }) => [
            styles.jumpBtn,
            (p || pressed.jump) && styles.jumpBtnActive,
          ]}
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
    alignItems: "center",
    gap: 8,
  },
  oneThumbRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  oneThumbJump: {
    width: 78,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(157, 0, 255, 0.22)",
    borderWidth: 2,
    borderColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  oneThumbJumpLabel: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  oneThumbPad: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(22, 24, 36, 0.75)",
    borderWidth: 1.5,
    borderColor: COLORS.borderGlow,
    alignItems: "center",
    justifyContent: "center",
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
