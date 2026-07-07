// Touch controls for landscape play.
//
// MULTI-TOUCH implementation:
//   We deliberately avoid `Pressable` and `react-native-gesture-handler`
//   here. Each button is a plain `<View>` with native `onTouchStart` /
//   `onTouchEnd` / `onTouchCancel` handlers. Android dispatches touch
//   events at the *native* level to whichever View is under a finger —
//   independently for every active pointer — so pressing LEFT and JUMP
//   simultaneously delivers two separate onTouchStart events to two
//   different Views. That's true multi-touch, and it works without any
//   native module (no crashes on new-arch / older Android versions).
//
// The one gotcha: `onTouchEnd` fires only for the last-ended pointer on
// the same View. To be safe we also treat `onTouchCancel` (which fires
// when the OS steals the touch — e.g. system gesture) as a release, and
// we NEVER return true from a responder callback (which would put us
// back into the single-responder-at-a-time regime).

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

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

interface ButtonProps {
  testID: string;
  onPress: () => void;
  onRelease: () => void;
  disabled?: boolean;
  slop: number;
  containerStyle: ViewStyle;
  activeStyle: ViewStyle;
  children: React.ReactNode;
}

/**
 * A tap-and-hold button that uses raw React Native touch events. Multi-
 * touch friendly, zero native-module dependencies, no responder-system
 * involvement.
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
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handleStart = () => {
    if (disabled) return;
    setPressed(true);
    onPress();
  };
  const handleEnd = () => {
    if (disabled) return;
    setPressed(false);
    onRelease();
  };

  return (
    <View
      testID={testID}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      // Guard against edge cases where the OS drops a touch stream: also
      // release if the finger leaves our bounds without firing end.
      onTouchMove={() => {}}
      style={[containerStyle, pressed && activeStyle]}
    >
      {children}
    </View>
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
