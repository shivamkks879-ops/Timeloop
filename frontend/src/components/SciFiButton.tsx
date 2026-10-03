// SciFiButton — unified, animated, double-tap-safe action button used by
// every modal / menu action in the game.
//
// Why centralise?
//   • Spec §6 "Button Visual Design" requires one consistent sci-fi
//     style across every screen, with clear NORMAL / PRESSED / RELEASED /
//     DISABLED states and a scale-down + brightness bump on press.
//   • Spec §7 "Button Functionality Bug Audit" requires each button to
//     fire exactly ONCE even if the user rage-taps during a modal fade,
//     and to never remain stuck in a pressed state after navigation.
//
// Design:
//   • Native `Pressable` → gives us accurate pressIn/pressOut (RN
//     already debounces at the OS level).
//   • Reanimated `useSharedValue` + `useAnimatedStyle` → runs the scale
//     + glow animation on the UI thread, so even a GC-busy JS thread
//     can't miss a press-feedback frame.
//   • `tapGuardMs` → ignores a 2nd `onPress` within 450 ms. Prevents
//     accidental double-navigation when a modal's fade-out happens to
//     cross under a rage tap.
//   • `variant`:
//       primary  — bright cyan fill, biggest glow (NEXT / RESUME / WATCH)
//       secondary— dark panel + cyan border (RETRY / QUIT / LEVELS)
//       danger   — red border, used for destructive confirms (future)
//   • `loading` → shows a muted "LOADING…" label and disables the press
//     without changing the layout size (so ad-fetches don't shift the UI).
//
// Touch target: minimum 48×44 regardless of label length (spec: ≥44 iOS,
// ≥48 Android).  Internal padding scales with font size.

import React, { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/src/game/constants";

export type SciFiButtonVariant = "primary" | "secondary" | "danger";

interface Props {
  label: string;
  onPress: () => void;
  variant?: SciFiButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Grow horizontally to fill its row. Use for the lone primary action. */
  stretch?: boolean;
  testID?: string;
  style?: ViewStyle;
  /** Optional icon glyph (unicode) to the left of the label. */
  icon?: string;
  /** Minimum ms between two successful onPress fires. Default 450. */
  tapGuardMs?: number;
}

export function SciFiButton({
  label,
  onPress,
  variant = "secondary",
  disabled,
  loading,
  stretch,
  testID,
  style,
  icon,
  tapGuardMs = 450,
}: Props) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  // Monotonic tap-guard — rejects a 2nd fire within tapGuardMs of the last
  // accepted press.  We keep this in a ref so the gesture callback can be
  // referentially stable (otherwise rapid re-renders could reset it).
  const lastFireRef = useRef(0);

  const inactive = disabled || loading;

  const onPressIn = useCallback(() => {
    if (inactive) return;
    scale.value = withTiming(0.955, { duration: 90 });
    glow.value = withTiming(1, { duration: 110 });
  }, [glow, scale, inactive]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 140 });
    glow.value = withTiming(0, { duration: 220 });
  }, [glow, scale]);

  const handlePress = useCallback(() => {
    if (inactive) return;
    const now = Date.now();
    if (now - lastFireRef.current < tapGuardMs) return;
    lastFireRef.current = now;
    onPress();
  }, [onPress, inactive, tapGuardMs]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: 0.3 + glow.value * 0.5,
  }));

  // --- Visual palette per variant ----------------------------------------
  const palette = useMemo(() => {
    switch (variant) {
      case "primary":
        return {
          bg: "rgba(0, 229, 255, 0.22)",
          bgPressed: "rgba(0, 229, 255, 0.38)",
          border: COLORS.cyan,
          glow: COLORS.cyan,
          text: COLORS.white,
        };
      case "danger":
        return {
          bg: "rgba(255, 0, 60, 0.18)",
          bgPressed: "rgba(255, 0, 60, 0.32)",
          border: COLORS.red,
          glow: COLORS.red,
          text: COLORS.white,
        };
      default:
        return {
          bg: "rgba(22, 24, 36, 0.82)",
          bgPressed: "rgba(0, 229, 255, 0.14)",
          border: COLORS.borderGlow,
          glow: COLORS.cyan,
          text: COLORS.white,
        };
    }
  }, [variant]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        stretch ? styles.wrapStretch : null,
        {
          shadowColor: palette.glow,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          // elevation gives Android a native shadow bump when pressed.
          elevation: inactive ? 0 : 6,
        },
        animStyle,
        style,
      ]}
    >
      <Pressable
        testID={testID}
        disabled={inactive}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        android_disableSound={false}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: pressed && !inactive ? palette.bgPressed : palette.bg,
            borderColor: palette.border,
            opacity: inactive ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.row}>
          {icon ? <Text style={[styles.icon, { color: palette.text }]}>{icon}</Text> : null}
          <Text style={[styles.label, { color: palette.text }]}>
            {loading ? "LOADING…" : label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
  },
  wrapStretch: {
    alignSelf: "stretch",
  },
  btn: {
    minHeight: 48,
    minWidth: 112,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    fontSize: 16,
    fontWeight: "900",
  },
  label: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 3,
    textAlign: "center",
  },
});
