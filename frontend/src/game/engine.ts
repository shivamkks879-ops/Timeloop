// Deterministic tick-based game engine for Time Loop Escape.
//
// PHASE 2 additions:
//   * Lasers: horizontal or vertical beams. Any alive actor overlapping a
//     beam segment dies. Dead actors stay put and continue to block, so echoes
//     become permanent shields for the rest of the loop.
//   * Moving platforms: defined per level with start/end waypoints. They only
//     travel while at least one plate is held. Actors standing on top are
//     carried by the platform's velocity each tick.
//   * Player death mid-loop no longer game-overs — it wraps into the next
//     loop (up to the echo budget). Only exceeding the budget ends the run.

import { INPUT, SIM } from "./constants";
import type {
  EchoRecording,
  Laser,
  LaserBeam,
  LevelDef,
  MovingPlatformDef,
  PlatformState,
  PlayerState,
  TileChar,
} from "./types";

export type Actor = PlayerState;

export interface EngineState {
  level: LevelDef;
  tick: number;
  loop: number;
  player: Actor;
  echoes: Actor[];
  recordings: EchoRecording[];
  currentInputs: Uint8Array;
  status: "playing" | "won" | "dead";
  spawnX: number;
  spawnY: number;
  width: number;
  height: number;
  tiles: TileChar[][];
  lasers: Laser[];
  platesPressed: Set<string>;
  platforms: PlatformState[];
  beams: LaserBeam[];
}

// Player AABB (slightly smaller than a tile so wall play feels forgiving)
export const PLAYER_W = 22;
export const PLAYER_H = 28;

// ---------- Level parsing ----------

export function parseLevel(level: LevelDef): {
  tiles: TileChar[][];
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  lasers: Laser[];
} {
  const height = level.grid.length;
  const width = Math.max(...level.grid.map((r) => r.length));
  const tiles: TileChar[][] = [];
  const lasers: Laser[] = [];
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
      } else if (c === "<" || c === ">" || c === "n" || c === "v") {
        lasers.push({
          tx: x,
          ty: y,
          dir: c === "<" ? "left" : c === ">" ? "right" : c === "n" ? "up" : "down",
        });
      }
    }
    tiles.push(row);
  }
  return { tiles, width, height, spawnX, spawnY, lasers };
}

// ---------- Initialisation ----------

function makePlatformState(def: MovingPlatformDef): PlatformState {
  const px = def.x0 * SIM.TILE;
  const py = def.y0 * SIM.TILE;
  return {
    def,
    phase: 0,
    osciDir: 1,
    px, py,
    pw: def.width * SIM.TILE,
    ph: def.height * SIM.TILE,
    dx: 0, dy: 0,
  };
}

export function initEngine(level: LevelDef): EngineState {
  const { tiles, width, height, spawnX, spawnY, lasers } = parseLevel(level);
  return {
    level,
    tick: 0,
    loop: 0,
    player: makeActor(spawnX, spawnY),
    echoes: [],
    recordings: [],
    currentInputs: new Uint8Array(SIM.LOOP_TICKS),
    status: "playing",
    spawnX, spawnY, width, height, tiles, lasers,
    platesPressed: new Set(),
    platforms: (level.platforms ?? []).map(makePlatformState),
    beams: [],
  };
}

function makeActor(x: number, y: number): Actor {
  return {
    x, y, vx: 0, vy: 0,
    onGround: false, wallDir: 0,
    coyote: 0, buffer: 0, wallLock: 0,
    alive: true, facing: 1,
    standingOn: null,
  };
}

export function beginNextLoop(state: EngineState): EngineState {
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
    platforms: (state.level.platforms ?? []).map(makePlatformState),
    beams: [],
    status: "playing",
  };
}

export function resetLevel(state: EngineState): EngineState {
  return initEngine(state.level);
}

// ---------- Collision helpers ----------

function isTileSolid(state: EngineState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return true;
  const t = state.tiles[ty][tx];
  if (t === "#" || t === "P") return true;
  if (t === "<" || t === ">" || t === "n" || t === "v") return true;
  if (t === "D") return state.platesPressed.size === 0;
  return false;
}

function isHazardTile(state: EngineState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  return state.tiles[ty][tx] === "^";
}

function tileAt(px: number, py: number) {
  return { tx: Math.floor(px / SIM.TILE), ty: Math.floor(py / SIM.TILE) };
}

function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function platformAt(state: EngineState, x: number, y: number): PlatformState | null {
  for (const p of state.platforms) {
    if (aabbOverlap(x, y, PLAYER_W, PLAYER_H, p.px, p.py, p.pw, p.ph)) return p;
  }
  return null;
}

function collidesBox(state: EngineState, x: number, y: number): boolean {
  // Tiles that AABB-overlap the player rect [x, x+PLAYER_W) × [y, y+PLAYER_H).
  const x0 = Math.floor(x / SIM.TILE);
  const x1 = Math.ceil((x + PLAYER_W) / SIM.TILE) - 1;
  const y0 = Math.floor(y / SIM.TILE);
  const y1 = Math.ceil((y + PLAYER_H) / SIM.TILE) - 1;
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isTileSolid(state, tx, ty)) return true;
  return platformAt(state, x, y) !== null;
}

function touchesHazard(state: EngineState, a: Actor): boolean {
  const x0 = Math.floor(a.x / SIM.TILE);
  const x1 = Math.ceil((a.x + PLAYER_W) / SIM.TILE) - 1;
  const y0 = Math.floor(a.y / SIM.TILE);
  const y1 = Math.ceil((a.y + PLAYER_H) / SIM.TILE) - 1;
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isHazardTile(state, tx, ty)) return true;
  return false;
}

function touchesGoal(state: EngineState, a: Actor): boolean {
  const cx = a.x + PLAYER_W / 2;
  const cy = a.y + PLAYER_H / 2;
  const { tx, ty } = tileAt(cx, cy);
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  return state.tiles[ty][tx] === "G";
}

function moveX(state: EngineState, a: Actor, dx: number) {
  const steps = Math.ceil(Math.abs(dx));
  const step = steps === 0 ? 0 : dx / steps;
  for (let i = 0; i < steps; i++) {
    const nx = a.x + step;
    if (collidesBox(state, nx, a.y)) {
      a.wallDir = step > 0 ? 1 : -1;
      a.vx = 0;
      return;
    }
    a.x = nx;
  }
}

function moveY(state: EngineState, a: Actor, dy: number) {
  const steps = Math.ceil(Math.abs(dy));
  const step = steps === 0 ? 0 : dy / steps;
  for (let i = 0; i < steps; i++) {
    const ny = a.y + step;
    if (collidesBox(state, a.x, ny)) {
      if (step > 0) a.onGround = true;
      a.vy = 0;
      return;
    }
    a.y = ny;
  }
}

function detectWall(state: EngineState, a: Actor): number {
  if (a.onGround) return 0;
  if (collidesBox(state, a.x - 1, a.y)) return -1;
  if (collidesBox(state, a.x + 1, a.y)) return 1;
  return 0;
}

function detectStandingOn(state: EngineState, a: Actor): string | null {
  if (!a.onGround) return null;
  const footY = a.y + PLAYER_H;
  for (const p of state.platforms) {
    if (Math.abs(footY - p.py) <= 2 &&
        a.x < p.px + p.pw && a.x + PLAYER_W > p.px) {
      return p.def.id;
    }
  }
  return null;
}

function computePlates(state: EngineState): Set<string> {
  const pressed = new Set<string>();
  const actors: Actor[] = [state.player, ...state.echoes];
  for (const a of actors) {
    // Both alive and dead corpses hold plates down.
    const left = a.x, right = a.x + PLAYER_W - 1;
    const footY = a.y + PLAYER_H;
    const x0 = Math.floor(left / SIM.TILE), x1 = Math.floor(right / SIM.TILE);
    const ty = Math.floor(footY / SIM.TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (
        tx >= 0 && ty >= 0 && tx < state.width && ty < state.height &&
        state.tiles[ty][tx] === "P"
      ) pressed.add(`${tx},${ty}`);
    }
  }
  return pressed;
}

// ---------- Moving platforms ----------

function updatePlatforms(state: EngineState) {
  const anyPlate = state.platesPressed.size > 0;
  for (const p of state.platforms) {
    const totalDist = Math.hypot(
      (p.def.x1 - p.def.x0) * SIM.TILE,
      (p.def.y1 - p.def.y0) * SIM.TILE
    ) || 1;
    const speedPhase = p.def.speed / totalDist;
    let newPhase = p.phase;
    if (p.def.trigger === "always") {
      // Ping-pong between 0 and 1.
      newPhase = p.phase + p.osciDir * speedPhase;
      if (newPhase >= 1) { newPhase = 1; p.osciDir = -1; }
      else if (newPhase <= 0) { newPhase = 0; p.osciDir = 1; }
    } else {
      // Plate-triggered: slide toward end while held, back to start otherwise.
      const target = anyPlate ? 1 : 0;
      if (p.phase < target) newPhase = Math.min(target, p.phase + speedPhase);
      else if (p.phase > target) newPhase = Math.max(target, p.phase - speedPhase);
    }
    p.phase = newPhase;
    const newPx = (p.def.x0 + (p.def.x1 - p.def.x0) * p.phase) * SIM.TILE;
    const newPy = (p.def.y0 + (p.def.y1 - p.def.y0) * p.phase) * SIM.TILE;
    p.dx = newPx - p.px;
    p.dy = newPy - p.py;
    p.px = newPx;
    p.py = newPy;
  }
}

function carryActors(state: EngineState) {
  const actors: Actor[] = [state.player, ...state.echoes];
  for (const a of actors) {
    if (!a.alive) continue;
    if (!a.standingOn) continue;
    const p = state.platforms.find((pl) => pl.def.id === a.standingOn);
    if (!p) continue;
    if (p.dx === 0 && p.dy === 0) continue;
    moveX(state, a, p.dx);
    moveY(state, a, p.dy);
  }
}

// ---------- Laser beams ----------

function beamAABB(b: LaserBeam) {
  // Tight hitbox: does NOT include the endpoint (blocker sits there).
  const perpHalf = 2;
  const isVertical = b.x1 === b.x2;
  if (isVertical) {
    const yMin = Math.min(b.y1, b.y2);
    const yMax = Math.max(b.y1, b.y2);
    return {
      bx: b.x1 - perpHalf,
      by: yMin,
      bw: perpHalf * 2,
      bh: yMax - yMin,
    };
  }
  const xMin = Math.min(b.x1, b.x2);
  const xMax = Math.max(b.x1, b.x2);
  return {
    bx: xMin,
    by: b.y1 - perpHalf,
    bw: xMax - xMin,
    bh: perpHalf * 2,
  };
}

function computeBeams(state: EngineState): LaserBeam[] {
  const beams: LaserBeam[] = [];
  const half = 2;
  const actors: Actor[] = [...state.echoes, state.player];

  for (const laser of state.lasers) {
    const emX = laser.tx * SIM.TILE;
    const emY = laser.ty * SIM.TILE;
    const cx = emX + SIM.TILE / 2;
    const cy = emY + SIM.TILE / 2;
    let x1 = cx, y1 = cy, x2 = cx, y2 = cy;
    let hitActor: Actor | null = null;

    if (laser.dir === "left" || laser.dir === "right") {
      const dir = laser.dir === "right" ? 1 : -1;
      x1 = dir > 0 ? emX + SIM.TILE : emX;
      y1 = cy;
      let stopAt = dir > 0 ? state.width * SIM.TILE : 0;
      const tyStart = Math.floor((cy - half) / SIM.TILE);
      const tyEnd = Math.floor((cy + half) / SIM.TILE);
      for (
        let tx = laser.tx + dir;
        dir > 0 ? tx < state.width : tx >= 0;
        tx += dir
      ) {
        let blocked = false;
        for (let ty = tyStart; ty <= tyEnd; ty++)
          if (isTileSolid(state, tx, ty)) { blocked = true; break; }
        if (blocked) {
          stopAt = dir > 0 ? tx * SIM.TILE : tx * SIM.TILE + SIM.TILE;
          break;
        }
      }
      for (const p of state.platforms) {
        if (p.py > cy + half || p.py + p.ph < cy - half) continue;
        if (dir > 0 && p.px > x1 && p.px < stopAt) stopAt = p.px;
        if (dir < 0 && p.px + p.pw < x1 && p.px + p.pw > stopAt) stopAt = p.px + p.pw;
      }
      for (const a of actors) {
        if (a.y > cy + half || a.y + PLAYER_H < cy - half) continue;
        if (dir > 0) {
          if (a.x >= x1 && a.x < stopAt) { stopAt = a.x; hitActor = a; }
        } else {
          if (a.x + PLAYER_W <= x1 && a.x + PLAYER_W > stopAt) { stopAt = a.x + PLAYER_W; hitActor = a; }
        }
      }
      x2 = stopAt; y2 = cy;
    } else {
      const dir = laser.dir === "down" ? 1 : -1;
      x1 = cx;
      y1 = dir > 0 ? emY + SIM.TILE : emY;
      let stopAt = dir > 0 ? state.height * SIM.TILE : 0;
      const txStart = Math.floor((cx - half) / SIM.TILE);
      const txEnd = Math.floor((cx + half) / SIM.TILE);
      for (
        let ty = laser.ty + dir;
        dir > 0 ? ty < state.height : ty >= 0;
        ty += dir
      ) {
        let blocked = false;
        for (let tx = txStart; tx <= txEnd; tx++)
          if (isTileSolid(state, tx, ty)) { blocked = true; break; }
        if (blocked) {
          stopAt = dir > 0 ? ty * SIM.TILE : ty * SIM.TILE + SIM.TILE;
          break;
        }
      }
      for (const p of state.platforms) {
        if (p.px > cx + half || p.px + p.pw < cx - half) continue;
        if (dir > 0 && p.py > y1 && p.py < stopAt) stopAt = p.py;
        if (dir < 0 && p.py + p.ph < y1 && p.py + p.ph > stopAt) stopAt = p.py + p.ph;
      }
      for (const a of actors) {
        if (a.x > cx + half || a.x + PLAYER_W < cx - half) continue;
        if (dir > 0) {
          if (a.y >= y1 && a.y < stopAt) { stopAt = a.y; hitActor = a; }
        } else {
          if (a.y + PLAYER_H <= y1 && a.y + PLAYER_H > stopAt) { stopAt = a.y + PLAYER_H; hitActor = a; }
        }
      }
      x2 = cx; y2 = stopAt;
    }

    beams.push({ laser, x1, y1, x2, y2, hitActor });
  }
  return beams;
}

function actorInAnyBeam(state: EngineState, a: Actor): boolean {
  for (const b of state.beams) {
    const { bx, by, bw, bh } = beamAABB(b);
    if (aabbOverlap(a.x, a.y, PLAYER_W, PLAYER_H, bx, by, bw, bh)) return true;
  }
  return false;
}

// ---------- Actor update ----------

function stepActor(state: EngineState, a: Actor, input: number) {
  if (!a.alive) return;

  const left = (input & INPUT.LEFT) !== 0;
  const right = (input & INPUT.RIGHT) !== 0;
  const jumpHeld = (input & INPUT.JUMP) !== 0;

  const dir = (left ? -1 : 0) + (right ? 1 : 0);
  if (a.wallLock > 0) a.wallLock -= 1;
  else if (dir !== 0) { a.vx = dir * SIM.MOVE_SPEED; a.facing = dir; }
  else a.vx = 0;

  if (jumpHeld) a.buffer = SIM.JUMP_BUFFER_TICKS;
  else if (a.buffer > 0) a.buffer -= 1;
  if (a.onGround) a.coyote = SIM.COYOTE_TICKS;
  else if (a.coyote > 0) a.coyote -= 1;

  if (a.buffer > 0) {
    if (a.coyote > 0) {
      a.vy = SIM.JUMP_VEL;
      a.buffer = 0; a.coyote = 0; a.onGround = false;
    } else if (a.wallDir !== 0 && !a.onGround) {
      a.vx = -a.wallDir * SIM.WALL_JUMP_X;
      a.vy = SIM.WALL_JUMP_Y;
      a.wallLock = SIM.WALL_JUMP_LOCK_TICKS;
      a.facing = -a.wallDir;
      a.buffer = 0;
    }
  }
  if (!jumpHeld && a.vy < SIM.JUMP_CUT) a.vy = SIM.JUMP_CUT;

  a.vy += SIM.GRAVITY;
  if (a.wallDir !== 0 && !a.onGround && a.vy > SIM.WALL_SLIDE_VEL) a.vy = SIM.WALL_SLIDE_VEL;
  if (a.vy > SIM.MAX_FALL) a.vy = SIM.MAX_FALL;

  a.onGround = false;
  moveX(state, a, a.vx);
  moveY(state, a, a.vy);
  a.wallDir = detectWall(state, a);
  a.standingOn = detectStandingOn(state, a);
}

// ---------- Public step ----------

export function step(state: EngineState, playerInput: number): EngineState {
  if (state.status !== "playing") return state;

  updatePlatforms(state);
  carryActors(state);

  state.currentInputs[state.tick] = playerInput;

  for (let i = 0; i < state.echoes.length; i++) {
    const rec = state.recordings[i];
    const echoInput = rec.inputs[state.tick] || 0;
    stepActor(state, state.echoes[i], echoInput);
  }
  stepActor(state, state.player, playerInput);

  state.platesPressed = computePlates(state);
  state.beams = computeBeams(state);

  // Deaths: hazards + laser hits.
  const allActors: Actor[] = [state.player, ...state.echoes];
  for (const a of allActors) {
    if (!a.alive) continue;
    if (touchesHazard(state, a)) { a.alive = false; continue; }
    // Killed by beam if we're in the beam segment OR we are the terminator.
    for (const b of state.beams) {
      if (b.hitActor === a) { a.alive = false; break; }
      const { bx, by, bw, bh } = beamAABB(b);
      if (aabbOverlap(a.x, a.y, PLAYER_W, PLAYER_H, bx, by, bw, bh)) { a.alive = false; break; }
    }
  }

  if (state.player.alive && touchesGoal(state, state.player)) {
    state.status = "won";
    return state;
  }

  const timerDone = state.tick + 1 >= SIM.LOOP_TICKS;
  const playerDead = !state.player.alive;
  if (playerDead || timerDone) {
    if (state.loop >= state.level.maxEchoes) {
      state.status = "dead";
      return state;
    }
    return beginNextLoop(state);
  }

  state.tick += 1;
  return state;
}

export function encodeInput(left: boolean, right: boolean, jump: boolean): number {
  let v = 0;
  if (left) v |= INPUT.LEFT;
  if (right) v |= INPUT.RIGHT;
  if (jump) v |= INPUT.JUMP;
  return v;
}

export function timeRemaining(state: EngineState): number {
  return (SIM.LOOP_TICKS - state.tick) / SIM.TPS;
}

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
