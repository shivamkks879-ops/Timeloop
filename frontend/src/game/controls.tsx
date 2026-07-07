// Touch controls — reliable multi-touch via a single-container touch tracker.
//
// Approach:
//   The whole controls overlay is ONE `<View>` with `onTouchStart/Move/End/Cancel`
//   handlers. We manually track every active touch pointer by its unique
//   `identifier`, and assign each pointer to whichever button it first
//   touched. When a pointer lifts, we release *only* that pointer's button.
//
// Why this pattern:
//   • React Native's per-View `onTouchEnd` on a `Pressable` or bare `View`
//     can silently drop the end event when the touch responder is stolen
//     by another button that starts under a different finger.  That leads
//     to the classic "character keeps walking" bug on Android.
//   • By handling all touches at a single parent View, we avoid the
//     responder-transfer problem entirely.  Android delivers ALL active
//     touches to that one view every frame.
//
// This gives true concurrent multi-touch (LEFT+JUMP together works), never
// gets stuck, and needs zero native modules — safe on every Android build.

import React, { useCallback, useMemo, useRef, useState } from "react";
import { GestureResponderEvent, StyleSheet, Text, View } from "react-native";

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

type ButtonId = "left" | "right" | "jump";

interface Hitbox {
  id: ButtonId;
  x: number;
  y: number;
  w: number;
  h: number;
  slop: number;
}

export function TouchControls({ onChange, paused, oneThumb, opacity }: Props) {
  const stateRef = useRef<ControlState>({ left: false, right: false, jump: false });
  const [pressedButtons, setPressedButtons] = useState<Record<ButtonId, boolean>>({
    left: false,
    right: false,
    jump: false,
  });

  // Layout: each button reports its measured position into this ref
  // (relative to the parent container) so the touch tracker knows what
  // pointer position corresponds to which button.
  const hitboxesRef = useRef<Record<ButtonId, Hitbox | null>>({ left: null, right: null, jump: null });
  // Refs to the button Views so we can measure their absolute page coords
  // whenever the layout tree changes (rotation, safe-area updates).
  const btnRefs = useRef<Record<ButtonId, View | null>>({ left: null, right: null, jump: null });

  // Pointer-identifier → button-id map.  When a touch starts we look up
  // which button it fell on; when it ends we release that button.
  const activeTouchesRef = useRef<Map<string, ButtonId>>(new Map());

  const disabled = !!paused;
  const alpha = typeof opacity === "number" ? Math.max(0.4, Math.min(1, opacity)) : 0.85;

  const emit = useCallback(() => {
    onChange({ ...stateRef.current });
  }, [onChange]);

  const setBtn = useCallback(
    (id: ButtonId, v: boolean) => {
      if (stateRef.current[id] === v) return;
      stateRef.current[id] = v;
      if (v) haptic("ui");
      emit();
      setPressedButtons((p) => ({ ...p, [id]: v }));
    },
    [emit],
  );

  // Given absolute page (x,y) from a touch event, figure out which button
  // — if any — the pointer fell on. Uses each hitbox's page-space bounds
  // (populated via `measure`) plus a `slop` margin for forgiving hits.
  const hitTest = useCallback((pageX: number, pageY: number): ButtonId | null => {
    const boxes = hitboxesRef.current;
    for (const id of ["left", "right", "jump"] as const) {
      const b = boxes[id];
      if (!b) continue;
      if (
        pageX >= b.x - b.slop &&
        pageX <= b.x + b.w + b.slop &&
        pageY >= b.y - b.slop &&
        pageY <= b.y + b.h + b.slop
      ) {
        return id;
      }
    }
    return null;
  }, []);

  const onTouchStart = (e: GestureResponderEvent) => {
    if (disabled) return;
    const changed = e.nativeEvent.changedTouches;
    for (const t of changed) {
      // Use page-absolute coordinates so we don't depend on which View is
      // the responder or how deep we are in the layout tree.
      const id = hitTest(t.pageX, t.pageY);
      if (!id) continue;
      activeTouchesRef.current.set(String(t.identifier), id);
      setBtn(id, true);
    }
  };

  const onTouchMove = () => {
    // We deliberately do NOT reassign a button on move.  A finger can
    // slide off a button (into the neighbouring slop) without breaking
    // the input — feels much better than a "twitchy" release-on-slide.
  };

  const releaseTouches = (e: GestureResponderEvent) => {
    if (disabled) return;
    const changed = e.nativeEvent.changedTouches;
    for (const t of changed) {
      const key = String(t.identifier);
      const id = activeTouchesRef.current.get(key);
      if (!id) continue;
      activeTouchesRef.current.delete(key);
      // Only release the button if no OTHER active touch is still
      // holding it (safe against "one finger held while another taps
      // the same button").
      const stillHeld = Array.from(activeTouchesRef.current.values()).some((v) => v === id);
      if (!stillHeld) setBtn(id, false);
    }
  };

  const onTouchEnd = releaseTouches;
  const onTouchCancel = releaseTouches;

  const measureButton = useCallback(
    (id: ButtonId, slop: number) => () => {
      const node = btnRefs.current[id];
      if (!node) return;
      // measureInWindow → page-absolute (x, y, width, height). We ignore
      // scroll offsets because there's no scrolling in the controls layer.
      // Some RN internals return the callback synchronously; catch a
      // potentially undefined implementation and skip if missing.
      const measurable = node as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };
      if (typeof measurable.measureInWindow !== "function") return;
      measurable.measureInWindow((x, y, w, h) => {
        hitboxesRef.current[id] = { id, x, y, w, h, slop };
      });
    },
    [],
  );

  // Container is a single View that captures every touch in its bounds.
  // `onStartShouldSetResponder` must return true so React Native routes
  // the whole touch stream to this View instead of a child.
  const responderProps = useMemo(
    () => ({
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderTerminationRequest: () => false,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    }),
    // Handlers close over refs — stable identities are fine here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled],
  );

  const styleFor = (id: ButtonId, base: any, active: any) =>
    pressedButtons[id] ? [base, active] : base;

  if (oneThumb) {
    return (
      <View style={[styles.root, { opacity: alpha }]} {...responderProps}>
        <View style={styles.oneThumbCluster}>
          <View
            testID="btn-left"
            ref={(r) => { btnRefs.current.left = r; }}
            onLayout={measureButton("left", 22)}
            style={styleFor("left", styles.padBtn, styles.padBtnActive)}
          >
            <Text style={styles.padGlyph}>{"\u25C0"}</Text>
          </View>
          <View style={{ width: 10 }} />
          <View
            testID="btn-jump"
            ref={(r) => { btnRefs.current.jump = r; }}
            onLayout={measureButton("jump", 20)}
            style={styleFor("jump", styles.jumpBtn, styles.jumpBtnActive)}
          >
            <Text style={styles.jumpLabel}>JUMP</Text>
          </View>
          <View style={{ width: 10 }} />
          <View
            testID="btn-right"
            ref={(r) => { btnRefs.current.right = r; }}
            onLayout={measureButton("right", 22)}
            style={styleFor("right", styles.padBtn, styles.padBtnActive)}
          >
            <Text style={styles.padGlyph}>{"\u25B6"}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { opacity: alpha }]} {...responderProps}>
      <View style={styles.leftCluster}>
        <View
          testID="btn-left"
          ref={(r) => { btnRefs.current.left = r; }}
          onLayout={measureButton("left", 22)}
          style={styleFor("left", styles.padBtn, styles.padBtnActive)}
        >
          <Text style={styles.padGlyph}>{"\u25C0"}</Text>
        </View>
        <View style={{ width: 18 }} />
        <View
          testID="btn-right"
          ref={(r) => { btnRefs.current.right = r; }}
          onLayout={measureButton("right", 22)}
          style={styleFor("right", styles.padBtn, styles.padBtnActive)}
        >
          <Text style={styles.padGlyph}>{"\u25B6"}</Text>
        </View>
      </View>

      <View style={styles.rightCluster}>
        <View
          testID="btn-jump"
          ref={(r) => { btnRefs.current.jump = r; }}
          onLayout={measureButton("jump", 20)}
          style={styleFor("jump", styles.jumpBtn, styles.jumpBtnActive)}
        >
          <Text style={styles.jumpLabel}>JUMP</Text>
        </View>
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
