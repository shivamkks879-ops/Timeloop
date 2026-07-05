// Lightweight audio hooks. In Phase 1 we ship silent stubs with proper wiring
// so the game logic already calls jump/land/echo/rewind/win sounds. In the
// polish phase, replace `playCue` with real expo-audio players without touching
// gameplay code.

export type Cue =
  | "jump"
  | "land"
  | "echo_create"
  | "rewind"
  | "portal"
  | "laser"
  | "win"
  | "die"
  | "ui_tap";

let audioEnabled = true;

export function setAudioEnabled(on: boolean) {
  audioEnabled = on;
}
export function isAudioEnabled() {
  return audioEnabled;
}

// Currently silent - the hook is what matters for future replacement.
export function playCue(_cue: Cue) {
  if (!audioEnabled) return;
  // Intentionally silent in Phase 1. Wired for real audio in polish phase.
}
