// Touch controls — powered by `react-native-gesture-handler` v2 gestures.
//
// Why gesture-handler and not raw Pressable / touch events?
//   • RN's built-in Pressable + touch responder system SERIALISES touches
//     through JS on Android, which regularly drops the second finger when
//     you press LEFT + JUMP together. That produced the "auto-walk" and
//     "jump doesn't fire" bugs.
//   • gesture-handler v2 runs on the UI thread and treats every button as
//     an INDEPENDENT gesture — Android's MotionEvent stream is split per
//     pointer, so LEFT and JUMP can fire simultaneously and never fight
//     over the responder.
//   • `Gesture.LongPress().minDuration(0)` acts as a pure "press and hold"
//     gesture with zero delay. `onStart` fires the instant the finger
//     lands; `onFinalize` fires whenever the finger lifts, whenever the
//     gesture is cancelled by the OS, and even if the app goes into
//     background — guaranteeing NO stuck-input state.
//   • `shouldCancelWhenOutside(false)` keeps the button pressed if the
//     finger slides slightly off the hitbox (thumb pressure spread).
//
// The root view uses `pointerEvents="box-none"` so touches outside the
// buttons pass through to the HUD (pause / restart) and never leak into
// the game canvas.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

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

  // Latest onChange ref — decouples the gesture callbacks from parent
  // re-renders so the gestures themselves are stable references.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Disabled ref — read from inside the JS-thread gesture callbacks so
  // we don't have to rebuild the gesture objects on pause/resume.
  const disabledRef = useRef(disabled);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

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
  // notification, home swipe), release every button. gesture-handler's
  // onFinalize will fire on backgrounding too, but this is belt-and-braces.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") releaseAll();
    });
    return () => sub.remove();
  }, [releaseAll]);

  // Build one LongPress gesture per button. Each gesture:
  //   • Fires immediately (minDuration 0) — no press-and-hold delay
  //   • Stays active if the finger drifts off the hitbox
  //   • Runs on the JS thread so we can call setState directly (no
  //     `runOnJS` wrapper needed — gesture-handler v2 handles this via
  //     `.runOnJS(true)`).
  //   • `onStart` = finger DOWN, `onFinalize` = finger UP / cancelled /
  //     app-backgrounded / OS-terminated. Both firing is guaranteed.
  //
  // Because each button owns its OWN gesture on its OWN view, Android
  // dispatches concurrent MotionEvents to each independently — that's
  // what makes true multi-touch (LEFT+JUMP together) work.
  const makeGesture = useCallback(
    (id: ButtonId) =>
      Gesture.LongPress()
        .minDuration(0)
        .maxDistance(10000) // effectively disable movement-based cancel
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onStart(() => {
          if (disabledRef.current) return;
          setBtn(id, true);
        })
        .onFinalize(() => {
          setBtn(id, false);
        }),
    [setBtn],
  );

  const leftGesture = useMemo(() => makeGesture("left"), [makeGesture]);
  const rightGesture = useMemo(() => makeGesture("right"), [makeGesture]);
  const jumpGesture = useMemo(() => makeGesture("jump"), [makeGesture]);

  if (oneThumb) {
    // Compact single-thumb layout: JUMP on top, LEFT/RIGHT below.
    return (
      <View style={[styles.root, { opacity: alpha }]} pointerEvents="box-none">
        <View style={styles.oneThumbCluster} pointerEvents="box-none">
          <GestureDetector gesture={jumpGesture}>
            <View
              testID="btn-jump"
              hitSlop={24}
              style={[styles.oneThumbJump, pressed.jump && styles.jumpBtnActive]}
            >
              <Text style={styles.oneThumbJumpLabel}>JUMP</Text>
            </View>
          </GestureDetector>
          <View style={styles.oneThumbRow} pointerEvents="box-none">
            <GestureDetector gesture={leftGesture}>
              <View
                testID="btn-left"
                hitSlop={26}
                style={[styles.oneThumbPad, pressed.left && styles.padBtnActive]}
              >
                <Text style={styles.padGlyph}>{"\u25C0"}</Text>
              </View>
            </GestureDetector>
            <View style={{ width: 8 }} />
            <GestureDetector gesture={rightGesture}>
              <View
                testID="btn-right"
                hitSlop={26}
                style={[styles.oneThumbPad, pressed.right && styles.padBtnActive]}
              >
                <Text style={styles.padGlyph}>{"\u25B6"}</Text>
              </View>
            </GestureDetector>
          </View>
        </View>
      </View>
    );
  }

  // Standard landscape layout: D-pad on the left, JUMP on the right.
  return (
    <View style={[styles.root, { opacity: alpha }]} pointerEvents="box-none">
      <View style={styles.leftCluster} pointerEvents="box-none">
        <GestureDetector gesture={leftGesture}>
          <View
            testID="btn-left"
            hitSlop={24}
            style={[styles.padBtn, pressed.left && styles.padBtnActive]}
          >
            <Text style={styles.padGlyph}>{"\u25C0"}</Text>
          </View>
        </GestureDetector>
        <View style={{ width: 18 }} />
        <GestureDetector gesture={rightGesture}>
          <View
            testID="btn-right"
            hitSlop={24}
            style={[styles.padBtn, pressed.right && styles.padBtnActive]}
          >
            <Text style={styles.padGlyph}>{"\u25B6"}</Text>
          </View>
        </GestureDetector>
      </View>

      <View style={styles.rightCluster} pointerEvents="box-none">
        <GestureDetector gesture={jumpGesture}>
          <View
            testID="btn-jump"
            hitSlop={22}
            style={[styles.jumpBtn, pressed.jump && styles.jumpBtnActive]}
          >
            <Text style={styles.jumpLabel}>JUMP</Text>
          </View>
        </GestureDetector>
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
