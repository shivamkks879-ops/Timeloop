// Real audio pack for Time Loop Escape.
//
// Uses `expo-audio`'s imperative `createAudioPlayer` API. Each SFX gets its own
// preloaded AudioPlayer that we `seekTo(0)` + `play()` on trigger so repeat
// cues are instantaneous with no allocation on the hot path.
//
// Music is a single looping player with lower default volume.
//
// Callers keep using `playCue(cue)` exactly as before; this module upgrades
// the underlying implementation without touching gameplay code.

import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

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

const SFX_VOLUME: Record<Cue, number> = {
  jump: 0.55,
  land: 0.45,
  echo_create: 0.7,
  rewind: 0.85,
  portal: 0.7,
  laser: 0.6,
  win: 0.9,
  die: 0.75,
  ui_tap: 0.4,
};

// Static require() references so Metro bundles the assets.
const SFX_SOURCES = {
  jump: require("../../assets/audio/jump.wav"),
  land: require("../../assets/audio/land.wav"),
  echo_create: require("../../assets/audio/echo_create.wav"),
  rewind: require("../../assets/audio/rewind.wav"),
  portal: require("../../assets/audio/portal.wav"),
  laser: require("../../assets/audio/laser.wav"),
  win: require("../../assets/audio/win.wav"),
  die: require("../../assets/audio/die.wav"),
  ui_tap: require("../../assets/audio/ui_tap.wav"),
} as const;

const MUSIC_SOURCE = require("../../assets/audio/music_loop.wav");

// ---------- State ----------

let sfxEnabled = true;
let musicEnabled = true;
let audioReady = false;

const sfxPlayers: Partial<Record<Cue, AudioPlayer>> = {};
let musicPlayer: AudioPlayer | null = null;

// ---------- Init / lifecycle ----------

export async function initAudio(): Promise<void> {
  if (audioReady) return;
  audioReady = true;

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsRecording: false,
      interruptionMode: "mixWithOthers",
    });
  } catch {
    // Best-effort — some platforms (web) may not support all fields.
  }

  // Preload each SFX with its own player.
  (Object.keys(SFX_SOURCES) as Cue[]).forEach((cue) => {
    try {
      const p = createAudioPlayer(SFX_SOURCES[cue]);
      p.volume = SFX_VOLUME[cue];
      p.loop = false;
      sfxPlayers[cue] = p;
    } catch (e) {
      if (__DEV__) console.warn(`[audio] failed to preload ${cue}`, e);
    }
  });

  try {
    musicPlayer = createAudioPlayer(MUSIC_SOURCE);
    musicPlayer.loop = true;
    musicPlayer.volume = 0.32;
  } catch (e) {
    if (__DEV__) console.warn("[audio] failed to preload music", e);
  }
}

export function disposeAudio(): void {
  Object.values(sfxPlayers).forEach((p) => {
    try {
      p?.release?.();
    } catch {}
  });
  (Object.keys(sfxPlayers) as Cue[]).forEach((k) => delete sfxPlayers[k]);
  try {
    musicPlayer?.release?.();
  } catch {}
  musicPlayer = null;
  audioReady = false;
}

// ---------- Public toggles ----------

export function setAudioEnabled(on: boolean): void {
  setSfxEnabled(on);
  setMusicEnabled(on);
}
export function isAudioEnabled(): boolean {
  return sfxEnabled || musicEnabled;
}

export function setSfxEnabled(on: boolean): void {
  sfxEnabled = on;
}
export function isSfxEnabled(): boolean {
  return sfxEnabled;
}

export function setMusicEnabled(on: boolean): void {
  musicEnabled = on;
  if (!musicPlayer) return;
  try {
    if (on) musicPlayer.play();
    else musicPlayer.pause();
  } catch {}
}
export function isMusicEnabled(): boolean {
  return musicEnabled;
}

// ---------- Playback ----------

export function playCue(cue: Cue): void {
  if (!sfxEnabled) return;
  const p = sfxPlayers[cue];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // Silently ignore — audio glitches must never break gameplay.
  }
}

export function startMusic(): void {
  if (!musicEnabled || !musicPlayer) return;
  try {
    musicPlayer.play();
  } catch {}
}

export function stopMusic(): void {
  if (!musicPlayer) return;
  try {
    musicPlayer.pause();
  } catch {}
}

export function resetMusic(): void {
  if (!musicPlayer) return;
  try {
    musicPlayer.seekTo(0);
  } catch {}
}
