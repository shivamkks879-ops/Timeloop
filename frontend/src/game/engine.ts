// Deterministic tick-based game engine for Time Loop Escape.
// - Fixed timestep (60 TPS)
// - AABB tile collision (axis-separated)
// - Player controller: coyote time, jump buffer, variable jump, wall slide/jump
// - Echoes: recorded input arrays replayed each loop through identical physics
// - Interactables: pressure plates open doors while any actor stands on them
//
// The engine is decoupled from rendering so it can be driven by both the UI
// and the automated playtest harness.

import { INPUT, SIM } from "./constants";
import type { EchoRecording, LevelDef, PlayerState, TileChar } from "./types";

export interface Actor extends PlayerState {}

export interface EngineState {
  level: LevelDef;
  tick: number;              // 0..LOOP_TICKS-1
  loop: number;              // completed loops (== recorded echoes)
  player: Actor;
  echoes: Actor[];           // one per recording
  recordings: EchoRecording[];
  currentInputs: Uint8Array; // recording buffer for the active loop
  status: "playing" | "won" | "dead";
  spawnX: number;
  spawnY: number;
  width: number;             // grid width in tiles
  height: number;            // grid height in tiles
  tiles: TileChar[][];       // [y][x]
  // Live per-tick derived state:
  platesPressed: Set<string>;// "x,y" of plates currently pressed
}

// Player AABB (a bit smaller than a tile so wall jumps feel forgiving)
export const PLAYER_W = 22;
export const PLAYER_H = 28;

// ---------- Level parsing ----------

export function parseLevel(level: LevelDef): {
  tiles: TileChar[][];
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
} {
  const height = level.grid.length;
  const width = Math.max(...level.grid.map((r) => r.length));
  const tiles: TileChar[][] = [];
  let spawnX = 0;
  let spawnY = 0;
  for (let y = 0; y < height; y++) {
    const row: TileChar[] = [];
    const line = level.grid[y].padEnd(width, ".");
    for (let x = 0; x < width; x++) {
      const c = line[x] as TileChar;
      row.push(c);
      if (c === "S") {
        spawnX = x * SIM.TILE + (SIM.TILE - PLAYER_W) / 2;
        spawnY = y * SIM.TILE + (SIM.TILE - PLAYER_H);
      }
    }
    tiles.push(row);
  }
  return { tiles, width, height, spawnX, spawnY };
}

// ---------- Initialisation ----------

export function initEngine(level: LevelDef): EngineState {
  const { tiles, width, height, spawnX, spawnY } = parseLevel(level);
  return {
    level,
    tick: 0,
    loop: 0,
    player: makeActor(spawnX, spawnY),
    echoes: [],
    recordings: [],
    currentInputs: new Uint8Array(SIM.LOOP_TICKS),
    status: "playing",
    spawnX,
    spawnY,
    width,
    height,
    tiles,
    platesPressed: new Set(),
  };
}

function makeActor(x: number, y: number): Actor {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    onGround: false,
    wallDir: 0,
    coyote: 0,
    buffer: 0,
    wallLock: 0,
    alive: true,
    facing: 1,
  };
}

// Reset for a new loop: keep tiles/level, respawn player, snapshot recording.
export function beginNextLoop(state: EngineState): EngineState {
  // Save recording of the just-completed loop as a new echo
  const rec: EchoRecording = {
    inputs: state.currentInputs,
    spawnX: state.spawnX,
    spawnY: state.spawnY,
  };
  const recordings = [...state.recordings, rec];
  const echoes = recordings.map(() => makeActor(state.spawnX, state.spawnY));
  return {
    ...state,
    tick: 0,
    loop: state.loop + 1,
    recordings,
    echoes,
    currentInputs: new Uint8Array(SIM.LOOP_TICKS),
    player: makeActor(state.spawnX, state.spawnY),
    platesPressed: new Set(),
    status: "playing",
  };
}

// Reset the entire level (retry).
export function resetLevel(state: EngineState): EngineState {
  return initEngine(state.level);
}

// ---------- Collision helpers ----------

function isSolid(state: EngineState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return true;
  const t = state.tiles[ty][tx];
  if (t === "#" || t === "P") return true;   // plates are walkable floor
  if (t === "D") {
    // Door: solid unless any plate is pressed
    return state.platesPressed.size === 0;
  }
  return false;
}

function isHazard(state: EngineState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  return state.tiles[ty][tx] === "^";
}

function tileAt(state: EngineState, px: number, py: number) {
  return { tx: Math.floor(px / SIM.TILE), ty: Math.floor(py / SIM.TILE) };
}

// Check if AABB overlaps a hazard tile
function touchesHazard(state: EngineState, a: Actor): boolean {
  const left = a.x;
  const right = a.x + PLAYER_W - 1;
  const top = a.y;
  const bottom = a.y + PLAYER_H - 1;
  const x0 = Math.floor(left / SIM.TILE);
  const x1 = Math.floor(right / SIM.TILE);
  const y0 = Math.floor(top / SIM.TILE);
  const y1 = Math.floor(bottom / SIM.TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isHazard(state, tx, ty)) return true;
  return false;
}

function touchesGoal(state: EngineState, a: Actor): boolean {
  const cx = a.x + PLAYER_W / 2;
  const cy = a.y + PLAYER_H / 2;
  const { tx, ty } = tileAt(state, cx, cy);
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  return state.tiles[ty][tx] === "G";
}

// Sweep-move on X axis with tile collision.
function moveX(state: EngineState, a: Actor, dx: number) {
  const steps = Math.ceil(Math.abs(dx));
  const step = steps === 0 ? 0 : dx / steps;
  for (let i = 0; i < steps; i++) {
    const nx = a.x + step;
    if (collidesBox(state, nx, a.y)) {
      // Hit wall - record wall direction and zero velocity
      a.wallDir = step > 0 ? 1 : -1;
      a.vx = 0;
      return;
    }
    a.x = nx;
  }
}

// Sweep-move on Y axis.
function moveY(state: EngineState, a: Actor, dy: number) {
  const steps = Math.ceil(Math.abs(dy));
  const step = steps === 0 ? 0 : dy / steps;
  for (let i = 0; i < steps; i++) {
    const ny = a.y + step;
    if (collidesBox(state, a.x, ny)) {
      if (step > 0) {
        a.onGround = true;
      }
      a.vy = 0;
      return;
    }
    a.y = ny;
  }
}

function collidesBox(state: EngineState, x: number, y: number): boolean {
  const left = x;
  const right = x + PLAYER_W - 1;
  const top = y;
  const bottom = y + PLAYER_H - 1;
  const x0 = Math.floor(left / SIM.TILE);
  const x1 = Math.floor(right / SIM.TILE);
  const y0 = Math.floor(top / SIM.TILE);
  const y1 = Math.floor(bottom / SIM.TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isSolid(state, tx, ty)) return true;
  return false;
}

// Detect wall touch (used for slide/jump). Returns -1, 0, or 1.
function detectWall(state: EngineState, a: Actor): number {
  if (a.onGround) return 0;
  // Try 1 pixel to each side
  if (collidesBox(state, a.x - 1, a.y)) return -1;
  if (collidesBox(state, a.x + 1, a.y)) return 1;
  return 0;
}

// Compute plates currently pressed by any actor.
function computePlates(state: EngineState): Set<string> {
  const pressed = new Set<string>();
  const actors = [state.player, ...state.echoes];
  for (const a of actors) {
    if (!a.alive) continue;
    // Actor "presses" plates whose top edge touches the actor's bottom.
    const left = a.x;
    const right = a.x + PLAYER_W - 1;
    const footY = a.y + PLAYER_H;
    const x0 = Math.floor(left / SIM.TILE);
    const x1 = Math.floor(right / SIM.TILE);
    const ty = Math.floor(footY / SIM.TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (
        tx >= 0 &&
        ty >= 0 &&
        tx < state.width &&
        ty < state.height &&
        state.tiles[ty][tx] === "P"
      ) {
        pressed.add(`${tx},${ty}`);
      }
    }
  }
  return pressed;
}

// ---------- Actor update (shared by player + echoes) ----------

function stepActor(state: EngineState, a: Actor, input: number) {
  if (!a.alive) return;

  const left = (input & INPUT.LEFT) !== 0;
  const right = (input & INPUT.RIGHT) !== 0;
  const jumpHeld = (input & INPUT.JUMP) !== 0;

  // Horizontal accel
  const dir = (left ? -1 : 0) + (right ? 1 : 0);
  if (a.wallLock > 0) {
    a.wallLock -= 1;
  } else if (dir !== 0) {
    a.vx = dir * SIM.MOVE_SPEED;
    a.facing = dir;
  } else {
    a.vx = 0;
  }

  // Jump buffer + coyote
  if (jumpHeld) {
    a.buffer = SIM.JUMP_BUFFER_TICKS;
  } else if (a.buffer > 0) {
    a.buffer -= 1;
  }
  if (a.onGround) a.coyote = SIM.COYOTE_TICKS;
  else if (a.coyote > 0) a.coyote -= 1;

  // Attempt jump
  if (a.buffer > 0) {
    if (a.coyote > 0) {
      a.vy = SIM.JUMP_VEL;
      a.buffer = 0;
      a.coyote = 0;
      a.onGround = false;
    } else if (a.wallDir !== 0 && !a.onGround) {
      // Wall jump: shove away from wall
      a.vx = -a.wallDir * SIM.WALL_JUMP_X;
      a.vy = SIM.WALL_JUMP_Y;
      a.wallLock = SIM.WALL_JUMP_LOCK_TICKS;
      a.facing = -a.wallDir;
      a.buffer = 0;
    }
  }
  // Variable jump: cut velocity if jump released while rising
  if (!jumpHeld && a.vy < SIM.JUMP_CUT) {
    a.vy = SIM.JUMP_CUT;
  }

  // Gravity (wall slide caps fall)
  a.vy += SIM.GRAVITY;
  if (a.wallDir !== 0 && !a.onGround && a.vy > SIM.WALL_SLIDE_VEL) {
    a.vy = SIM.WALL_SLIDE_VEL;
  }
  if (a.vy > SIM.MAX_FALL) a.vy = SIM.MAX_FALL;

  // Move
  a.onGround = false;
  moveX(state, a, a.vx);
  moveY(state, a, a.vy);
  a.wallDir = detectWall(state, a);

  // Hazard death
  if (touchesHazard(state, a)) a.alive = false;
}

// ---------- Public step ----------

// Perform exactly one simulation tick given the player's current input flags.
// Returns the updated state (same object mutated for perf; caller can snapshot).
export function step(state: EngineState, playerInput: number): EngineState {
  if (state.status !== "playing") return state;

  // Record player's input for this tick
  state.currentInputs[state.tick] = playerInput;

  // Step echoes with recorded inputs
  for (let i = 0; i < state.echoes.length; i++) {
    const rec = state.recordings[i];
    const echoInput = rec.inputs[state.tick] || 0;
    stepActor(state, state.echoes[i], echoInput);
  }
  // Step player
  stepActor(state, state.player, playerInput);

  // Recompute plates (affects doors next tick + goal check)
  state.platesPressed = computePlates(state);

  // Goal check for player
  if (state.player.alive && touchesGoal(state, state.player)) {
    state.status = "won";
    return state;
  }
  // Death check
  if (!state.player.alive) {
    state.status = "dead";
    return state;
  }

  // Advance tick / loop
  state.tick += 1;
  if (state.tick >= SIM.LOOP_TICKS) {
    // End of loop - either advance loop or fail if out of echo budget
    if (state.loop >= state.level.maxEchoes) {
      state.status = "dead";
      return state;
    }
    return beginNextLoop(state);
  }
  return state;
}

// Serialize inputs from a boolean control object.
export function encodeInput(left: boolean, right: boolean, jump: boolean): number {
  let v = 0;
  if (left) v |= INPUT.LEFT;
  if (right) v |= INPUT.RIGHT;
  if (jump) v |= INPUT.JUMP;
  return v;
}

// Time remaining in seconds (0..10)
export function timeRemaining(state: EngineState): number {
  return (SIM.LOOP_TICKS - state.tick) / SIM.TPS;
}

// Compute grade based on echoes used vs par.
export function computeGrade(
  level: LevelDef,
  echoesUsed: number
): "S" | "A" | "B" | "C" {
  if (echoesUsed <= level.parEchoes) return "S";
  if (echoesUsed <= level.parEchoes + 1) return "A";
  if (echoesUsed <= level.maxEchoes) return "B";
  return "C";
}

export function gradeToStars(g: "S" | "A" | "B" | "C"): number {
  return g === "S" ? 3 : g === "A" ? 2 : 1;
}
