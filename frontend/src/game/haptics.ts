// Haptic feedback helper — reads the `hapticsOn` flag from the cached save
// so we can guard vibration cheaply from the 60Hz game loop.
//
// We intentionally use a light-weight in-memory flag (mirrored from save)
// so we never hit AsyncStorage from the tick loop.
//
// Haptic *profiles* map game events → a specific vibration flavour:
//   • jump / land   → light impact (subtle tactile feedback)
//   • portal / key  → selection change (crisp UI blip)
//   • death / laser → medium impact (feels like a hit)
//   • rewind        → heavy impact (dramatic rewind punctuation)
//   • win           → success notification

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}
export function isHapticsEnabled() {
  return enabled;
}

export type HapticCue =
  | "jump"
  | "land"
  | "portal"
  | "key"
  | "death"
  | "laser"
  | "rewind"
  | "win"
  | "ui";

// Coalesce noisy events (e.g. multiple lasers in one tick) so we don't
// spam the taptic engine.
let lastFireMs = 0;
const MIN_GAP_MS = 40;

export function haptic(cue: HapticCue) {
  if (!enabled) return;
  // Web has no vibration API in expo-haptics (returns no-op) — bail early.
  if (Platform.OS === "web") return;
  const now = Date.now();
  if (now - lastFireMs < MIN_GAP_MS) return;
  lastFireMs = now;
  try {
    switch (cue) {
      case "jump":
      case "land":
      case "ui":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "portal":
      case "key":
        Haptics.selectionAsync();
        break;
      case "death":
      case "laser":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "rewind":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "win":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
    }
  } catch {
    // Some devices / dev clients don't have the taptic engine — silent noop.
  }
}
