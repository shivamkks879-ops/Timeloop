// Touch controls for landscape play.
//
// MULTI-TOUCH:
//   Uses `react-native-gesture-handler`'s `Gesture.LongPress` (with a zero
//   minimum duration and effectively infinite maxDistance) for each button.
//   RNGH dispatches touches at the *native* Android/iOS level BEFORE React
//   Native's synthetic responder system runs, and each `GestureDetector`
//   owns its own pointer stream. This guarantees LEFT + JUMP (or RIGHT +
//   JUMP) can be pressed simultaneously — which the plain `Pressable`
//   sometimes fails to deliver on certain Android touch layers.
//
// LAYOUTS:
//   • Standard mode: LEFT/RIGHT bottom-left, JUMP bottom-right.
//   • One-thumb mode: All three buttons stacked on the LEFT side.
//
// UX niceties: enlarged hit-slop (bigger effective touch area than the
// visible glyph), lighter jump button, cyan/purple neon accents, dark base.

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  opacity?: number;   // 0.4 – 1.0 (default 0.85). Applied to whole overlay.
}

/**
 * Single button that reports press-in / press-out via a LongPress gesture
 * (min duration 0). Renders its own pressed state so we don't need to
 * re-render the parent controls on every touch event.
 */
function GameButton({
  testID,
  onPress,
  onRelease,
  disabled,
  slop,
  containerStyle,
  activeStyle,
  children,
}: {
  testID: string;
  onPress: () => void;
  onRelease: () => void;
  disabled?: boolean;
  slop: number;
  containerStyle: any;
  activeStyle: any;
  children: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  // `runOnJS` is unnecessary here — LongPress's callbacks are already on the
  // JS thread when the gesture is built without a worklet-mode explicit flag.
  const gesture = React.useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(0)              // fire on touch-down, not after a delay
        .maxDistance(10_000)         // never cancel on slight finger drift
        .shouldCancelWhenOutside(false)
        .enabled(!disabled)
        .onBegin(() => {
          setPressed(true);
          onPress();
        })
        .onFinalize(() => {
          setPressed(false);
          onRelease();
        }),
    [disabled, onPress, onRelease],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={testID}
        hitSlop={slop}
        style={[containerStyle, pressed && activeStyle]}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

export function TouchControls({ onChange, paused, oneThumb, opacity }: Props) {
  const stateRef = useRef<ControlState>({ left: false, right: false, jump: false });

  const set = useCallback(
    (k: keyof ControlState, v: boolean) => {
      stateRef.current[k] = v;
      if (v) haptic("ui");
      onChange({ ...stateRef.current });
    },
    [onChange],
  );

  const disabled = !!paused;
  const alpha = typeof opacity === "number" ? Math.max(0.4, Math.min(1, opacity)) : 0.85;

  // Callbacks are stable — GameButton memoises on identity.
  const leftDown = useCallback(() => set("left", true), [set]);
  const leftUp = useCallback(() => set("left", false), [set]);
  const rightDown = useCallback(() => set("right", true), [set]);
  const rightUp = useCallback(() => set("right", false), [set]);
  const jumpDown = useCallback(() => set("jump", true), [set]);
  const jumpUp = useCallback(() => set("jump", false), [set]);

  if (oneThumb) {
    return (
      <View style={[styles.root, { opacity: alpha }]} pointerEvents="box-none">
        <View style={styles.oneThumbCluster}>
          <GameButton
            testID="btn-left"
            onPress={leftDown}
            onRelease={leftUp}
            disabled={disabled}
            slop={22}
            containerStyle={styles.padBtn}
            activeStyle={styles.padBtnActive}
          >
            <Text style={styles.padGlyph}>{"\u25C0"}</Text>
          </GameButton>
          <View style={{ width: 10 }} />
          <GameButton
            testID="btn-jump"
            onPress={jumpDown}
            onRelease={jumpUp}
            disabled={disabled}
            slop={20}
            containerStyle={styles.jumpBtn}
            activeStyle={styles.jumpBtnActive}
          >
            <Text style={styles.jumpLabel}>JUMP</Text>
          </GameButton>
          <View style={{ width: 10 }} />
          <GameButton
            testID="btn-right"
            onPress={rightDown}
            onRelease={rightUp}
            disabled={disabled}
            slop={22}
            containerStyle={styles.padBtn}
            activeStyle={styles.padBtnActive}
          >
            <Text style={styles.padGlyph}>{"\u25B6"}</Text>
          </GameButton>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { opacity: alpha }]} pointerEvents="box-none">
      <View style={styles.leftCluster}>
        <GameButton
          testID="btn-left"
          onPress={leftDown}
          onRelease={leftUp}
          disabled={disabled}
          slop={22}
          containerStyle={styles.padBtn}
          activeStyle={styles.padBtnActive}
        >
          <Text style={styles.padGlyph}>{"\u25C0"}</Text>
        </GameButton>
        <View style={{ width: 18 }} />
        <GameButton
          testID="btn-right"
          onPress={rightDown}
          onRelease={rightUp}
          disabled={disabled}
          slop={22}
          containerStyle={styles.padBtn}
          activeStyle={styles.padBtnActive}
        >
          <Text style={styles.padGlyph}>{"\u25B6"}</Text>
        </GameButton>
      </View>

      <View style={styles.rightCluster}>
        <GameButton
          testID="btn-jump"
          onPress={jumpDown}
          onRelease={jumpUp}
          disabled={disabled}
          slop={20}
          containerStyle={styles.jumpBtn}
          activeStyle={styles.jumpBtnActive}
        >
          <Text style={styles.jumpLabel}>JUMP</Text>
        </GameButton>
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
