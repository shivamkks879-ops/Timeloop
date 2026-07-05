// Time Loop Escape - Core constants
// Physics tuned for feel: forgiving jumps, precise wall play, snappy air control.

export const COLORS = {
  bg: "#0A0B10",
  panel: "#161824",
  overlay: "rgba(10, 11, 16, 0.85)",
  cyan: "#00E5FF",
  purple: "#9D00FF",
  red: "#FF003C",
  green: "#00FF88",
  white: "#FFFFFF",
  textPrimary: "#FFFFFF",
  textSecondary: "#8A93A6",
  textMuted: "#4B5263",
  borderGlow: "rgba(0, 229, 255, 0.35)",
  echoTint: "rgba(157, 0, 255, 0.55)",
};

// Simulation constants (deterministic, tick-based)
export const SIM = {
  TPS: 60,               // ticks per second (fixed timestep)
  LOOP_TICKS: 600,       // 10 seconds per loop
  TILE: 32,              // logical pixels per tile
  GRAVITY: 0.55,
  MAX_FALL: 12,
  MOVE_SPEED: 3.6,
  JUMP_VEL: -10.5,
  JUMP_CUT: -4,          // velocity cap when jump released early
  COYOTE_TICKS: 7,
  JUMP_BUFFER_TICKS: 7,
  WALL_SLIDE_VEL: 2.2,
  WALL_JUMP_X: 7.5,
  WALL_JUMP_Y: -10,
  WALL_JUMP_LOCK_TICKS: 8,
  MAX_ECHOES: 6,
};

// Input bit flags packed into Uint8Array per tick
export const INPUT = {
  LEFT: 1 << 0,
  RIGHT: 1 << 1,
  JUMP: 1 << 2,
};
