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
import { AppState, Dimensions, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  // ------------------------------------------------------------------
  //  Device-aware sizing & positioning
  //
  //  Curved-display phones (Samsung Edge, Xiaomi Poco F5, OnePlus, etc.)
  //  and MIUI / HyperOS ROMs aggressively REJECT touches within a
  //  ~20-30 px band along the curved side edges to stop accidental
  //  palm inputs. If a button hitbox falls inside that band, single-
  //  finger presses simply don't register. We therefore:
  //    1. Read the OS-reported safe-area insets (`useSafeAreaInsets`)
  //       — non-zero on notched / cutout devices.
  //    2. Add an EDGE_BUFFER on top for MIUI-style rejection zones.
  //    3. Scale button size proportional to the shorter screen
  //       dimension so a 6.67" phone (Poco F5) gets bigger buttons
  //       than a 5.5" phone but never so big they overlap.
  //
  //  This is the fix for "jump button proper response nahi kar raha"
  //  on the Poco F5 in particular.
  // ------------------------------------------------------------------
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = Dimensions.get("window");
  const shortSide = Math.min(winW, winH);
  // Buttons scale with screen — clamped to a sane range.
  const btnPad = Math.round(Math.max(72, Math.min(96, shortSide * 0.13)));   // D-pad button
  const btnJump = Math.round(Math.max(84, Math.min(112, shortSide * 0.15))); // JUMP button
  // Extra buffer added to whatever the OS reports as safe-area — this is
  // the MIUI edge-rejection compensation.
  const EDGE_BUFFER = 24;
  const dpadGap = Math.round(btnPad * 0.32);
  const padLeft = Math.max(28, insets.left + EDGE_BUFFER);
  const padRight = Math.max(28, insets.right + EDGE_BUFFER);
  const padBottom = Math.max(24, insets.bottom + 18);

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
  //   • Runs on the JS thread so we can call setState directly
  //   • `onBegin` = finger DOWN (fires the INSTANT a touch is detected,
  //     BEFORE any activation criteria — this is what makes JUMP feel
  //     responsive even on ROMs with aggressive palm rejection like
  //     MIUI / HyperOS on Poco F5).
  //   • `onFinalize` = finger UP / cancelled / app-backgrounded /
  //     OS-terminated. Guaranteed to fire — no stuck-input state.
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
        .onBegin(() => {
          if (disabledRef.current) return;
          setBtn(id, true);
        })
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

  // ------------------------------------------------------------------
  //  Dynamic style objects built from the device-aware sizes computed
  //  above. StyleSheet is used for everything visual; only the
  //  size / position values are computed per-render (cheap primitive
  //  values, memoised via useMemo).
  // ------------------------------------------------------------------
  const dyn = useMemo(() => ({
    root: {
      paddingLeft: padLeft,
      paddingRight: padRight,
      paddingBottom: padBottom,
    },
    padBtn: {
      width: btnPad,
      height: btnPad,
      borderRadius: btnPad / 2,
    },
    jumpBtn: {
      width: btnJump,
      height: btnJump,
      borderRadius: btnJump / 2,
    },
    padGap: { width: dpadGap },
    padGlyph: { fontSize: Math.round(btnPad * 0.38) },
    jumpLabel: { fontSize: Math.round(btnJump * 0.20) },
    // hitSlop grows with button so the effective touch area is still
    // buffer-padded even on tablets.
    padHit: Math.round(btnPad * 0.35),
    jumpHit: Math.round(btnJump * 0.32),
    // One-thumb cluster: match the D-pad sizing but a bit tighter.
    oneThumbJump: {
      width: Math.round(btnPad * 1.25),
      height: Math.round(btnPad * 0.95),
      borderRadius: Math.round(btnPad * 0.475),
    },
    oneThumbPad: {
      width: Math.round(btnPad * 0.9),
      height: Math.round(btnPad * 0.9),
      borderRadius: Math.round(btnPad * 0.45),
    },
  }), [padLeft, padRight, padBottom, btnPad, btnJump, dpadGap]);

  if (oneThumb) {
    // Compact single-thumb layout: JUMP on top, LEFT/RIGHT below.
    return (
      <View style={[styles.root, dyn.root, { opacity: alpha }]} pointerEvents="box-none">
        <View style={styles.oneThumbCluster} pointerEvents="box-none">
          <GestureDetector gesture={jumpGesture}>
            <View
              testID="btn-jump"
              hitSlop={dyn.jumpHit}
              style={[styles.oneThumbJump, dyn.oneThumbJump, pressed.jump && styles.jumpBtnActive]}
            >
              <Text style={[styles.oneThumbJumpLabel, dyn.jumpLabel]}>JUMP</Text>
            </View>
          </GestureDetector>
          <View style={styles.oneThumbRow} pointerEvents="box-none">
            <GestureDetector gesture={leftGesture}>
              <View
                testID="btn-left"
                hitSlop={dyn.padHit}
                style={[styles.oneThumbPad, dyn.oneThumbPad, pressed.left && styles.padBtnActive]}
              >
                <Text style={[styles.padGlyph, dyn.padGlyph]}>{"\u25C0"}</Text>
              </View>
            </GestureDetector>
            <View style={{ width: 10 }} />
            <GestureDetector gesture={rightGesture}>
              <View
                testID="btn-right"
                hitSlop={dyn.padHit}
                style={[styles.oneThumbPad, dyn.oneThumbPad, pressed.right && styles.padBtnActive]}
              >
                <Text style={[styles.padGlyph, dyn.padGlyph]}>{"\u25B6"}</Text>
              </View>
            </GestureDetector>
          </View>
        </View>
      </View>
    );
  }

  // Standard landscape layout: D-pad on the left, JUMP on the right.
  return (
    <View style={[styles.root, dyn.root, { opacity: alpha }]} pointerEvents="box-none">
      <View style={styles.leftCluster} pointerEvents="box-none">
        <GestureDetector gesture={leftGesture}>
          <View
            testID="btn-left"
            hitSlop={dyn.padHit}
            style={[styles.padBtn, dyn.padBtn, pressed.left && styles.padBtnActive]}
          >
            <Text style={[styles.padGlyph, dyn.padGlyph]}>{"\u25C0"}</Text>
          </View>
        </GestureDetector>
        <View style={dyn.padGap} />
        <GestureDetector gesture={rightGesture}>
          <View
            testID="btn-right"
            hitSlop={dyn.padHit}
            style={[styles.padBtn, dyn.padBtn, pressed.right && styles.padBtnActive]}
          >
            <Text style={[styles.padGlyph, dyn.padGlyph]}>{"\u25B6"}</Text>
          </View>
        </GestureDetector>
      </View>

      <View style={styles.rightCluster} pointerEvents="box-none">
        <GestureDetector gesture={jumpGesture}>
          <View
            testID="btn-jump"
            hitSlop={dyn.jumpHit}
            style={[styles.jumpBtn, dyn.jumpBtn, pressed.jump && styles.jumpBtnActive]}
          >
            <Text style={[styles.jumpLabel, dyn.jumpLabel]}>JUMP</Text>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

// The static StyleSheet holds colour + border + typography-family
// properties. Anything that scales with the physical screen (widths,
// heights, radii, font sizes) is applied through the `dyn` object built
// in the render body so it responds to Dimensions changes (rotation /
// fold / split-screen) and to per-device safe-area insets.
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
    gap: 10,
  },
  oneThumbRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  oneThumbJump: {
    backgroundColor: "rgba(157, 0, 255, 0.22)",
    borderWidth: 2,
    borderColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  oneThumbJumpLabel: {
    color: COLORS.white,
    fontWeight: "900",
    letterSpacing: 2,
  },
  oneThumbPad: {
    backgroundColor: "rgba(22, 24, 36, 0.75)",
    borderWidth: 1.5,
    borderColor: COLORS.borderGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  padBtn: {
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
    fontWeight: "800",
  },
  jumpBtn: {
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
    fontWeight: "900",
    letterSpacing: 2,
  },
});
