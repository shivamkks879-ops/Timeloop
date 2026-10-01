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
  SentryDef,
  SentryState,
  TileChar,
} from "./types";

export type Actor = PlayerState;

// Sentry visual bounding box (slightly smaller than a tile).
export const SENTRY_W = 26;
export const SENTRY_H = 26;

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
  keyCollected: boolean;
  collectedKeys: Set<string>;       // tile coords "x,y" of consumed key tiles
  sentries: SentryState[];
  bossPressed: Set<string>;         // persistent boss plates across all loops
  totalBossPlates: number;          // total number of B plates originally in the level
  // Transient death FX — set the instant the player (or any echo) dies.
  // Renderer reads this and spawns a short electric burst + screen flash.
  // Cleared automatically when `fxTicksLeft` reaches 0.
  deathFx: {
    x: number;         // centre x of the burst (pixels)
    y: number;         // centre y of the burst (pixels)
    cause: "beam" | "sentry" | "hazard";
    fxTicksLeft: number; // decremented each step; renderer fades proportional to this
    isPlayer: boolean; // true = player death → stronger flash; false = echo
  } | null;
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
  // Count all initial `B` boss plates in the level so we know when the H
  // boss-door should unlock.
  let totalBossPlates = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] === "B") totalBossPlates++;
    }
  }
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
    keyCollected: false,
    collectedKeys: new Set(),
    sentries: (level.sentries ?? []).map(makeSentryState),
    bossPressed: new Set(),
    totalBossPlates,
    deathFx: null,
  };
}

function makeSentryState(def: SentryDef): SentryState {
  const phase = def.phase0 ?? 0;
  const px = def.x0 * SIM.TILE + (SIM.TILE - SENTRY_W) / 2;
  const py = def.y0 * SIM.TILE + (SIM.TILE - SENTRY_H) / 2;
  return {
    def,
    phase,
    dir: 1,
    px: px + (def.x1 - def.x0) * SIM.TILE * phase,
    py: py + (def.y1 - def.y0) * SIM.TILE * phase,
    stalled: false,
  };
}

function makeActor(x: number, y: number): Actor {
  return {
    x, y, vx: 0, vy: 0,
    onGround: false, wallDir: 0,
    coyote: 0, buffer: 0, wallLock: 0,
    alive: true, facing: 1,
    standingOn: null,
    gravityDir: 1, flipCd: 0, teleCd: 0,
  };
}

// Find the paired portal (`1` <-> `2`) coordinates in the grid, if any.
function findPortalPair(state: EngineState, targetChar: "1" | "2"): { tx: number; ty: number } | null {
  for (let y = 0; y < state.height; y++)
    for (let x = 0; x < state.width; x++)
      if (state.tiles[y][x] === targetChar) return { tx: x, ty: y };
  return null;
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
    // Sentries reset to their initial pose each loop (deterministic).
    sentries: (state.level.sentries ?? []).map(makeSentryState),
    // Boss plates PERSIST across loops (that's the whole point of boss phases).
    bossPressed: state.bossPressed,
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
  if (t === "L") return !state.keyCollected;
  // Time Rifts: `R` = solid on EVEN loops (0, 2, ...), passable on odd.
  //             `r` = solid on ODD  loops (1, 3, ...), passable on even.
  if (t === "R") return state.loop % 2 === 0;
  if (t === "r") return state.loop % 2 === 1;
  // Boss-locked door: solid until ALL B plates in the level have been
  // pressed at least once (persistent across loops). Once every plate is
  // pressed, the door stays open for the rest of the run.
  if (t === "H") return state.bossPressed.size < state.totalBossPlates;
  // ~, 1, 2, k, B are non-solid interactable tiles
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

function detectStandingOnLegacy(): null {
  return null;
}

// detectWall stays direction-agnostic (walls are walls in either gravity dir).
function detectWall(state: EngineState, a: Actor): number {
  if (a.onGround) return 0;
  if (collidesBox(state, a.x - 1, a.y)) return -1;
  if (collidesBox(state, a.x + 1, a.y)) return 1;
  return 0;
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
  if (a.flipCd > 0) a.flipCd -= 1;
  if (a.teleCd > 0) a.teleCd -= 1;

  const left = (input & INPUT.LEFT) !== 0;
  const right = (input & INPUT.RIGHT) !== 0;
  const jumpHeld = (input & INPUT.JUMP) !== 0;
  const gDir = a.gravityDir;

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
      a.vy = SIM.JUMP_VEL * gDir;
      a.buffer = 0; a.coyote = 0; a.onGround = false;
    } else if (a.wallDir !== 0 && !a.onGround) {
      a.vx = -a.wallDir * SIM.WALL_JUMP_X;
      a.vy = SIM.WALL_JUMP_Y * gDir;
      a.wallLock = SIM.WALL_JUMP_LOCK_TICKS;
      a.facing = -a.wallDir;
      a.buffer = 0;
    }
  }
  // Variable jump: cut velocity if jump released while still rising.
  if (!jumpHeld && a.vy * gDir < SIM.JUMP_CUT) a.vy = SIM.JUMP_CUT * gDir;

  a.vy += SIM.GRAVITY * gDir;
  if (a.wallDir !== 0 && !a.onGround && a.vy * gDir > SIM.WALL_SLIDE_VEL) {
    a.vy = SIM.WALL_SLIDE_VEL * gDir;
  }
  if (a.vy * gDir > SIM.MAX_FALL) a.vy = SIM.MAX_FALL * gDir;

  a.onGround = false;
  moveX(state, a, a.vx);
  moveY(state, a, a.vy);
  a.wallDir = detectWall(state, a);
  a.standingOn = detectStandingOn(state, a);

  // Interact with gravity-flip tiles + teleport portals.
  interactTiles(state, a);
}

// If the actor's centre sits on a `~` tile, toggle gravity (respecting cooldown).
// If it sits on a `1` or `2` tile, teleport to the paired portal (respecting cooldown).
function interactTiles(state: EngineState, a: Actor) {
  const cx = a.x + PLAYER_W / 2;
  const cy = a.y + PLAYER_H / 2;
  const tx = Math.floor(cx / SIM.TILE);
  const ty = Math.floor(cy / SIM.TILE);
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return;
  const t = state.tiles[ty][tx];
  if (t === "~" && a.flipCd === 0) {
    a.gravityDir = (a.gravityDir === 1 ? -1 : 1) as 1 | -1;
    a.flipCd = 20;
    a.vy = 0;
    a.onGround = false;
  } else if ((t === "1" || t === "2") && a.teleCd === 0) {
    const other = findPortalPair(state, t === "1" ? "2" : "1");
    if (other) {
      a.x = other.tx * SIM.TILE + (SIM.TILE - PLAYER_W) / 2;
      a.y = other.ty * SIM.TILE + (SIM.TILE - PLAYER_H) / 2;
      a.vx = 0; a.vy = 0;
      a.teleCd = 20;
    }
  } else if (t === "k") {
    // Consume the key tile: mark the key collected and remove from grid.
    const id = `${tx},${ty}`;
    if (!state.collectedKeys.has(id)) {
      state.collectedKeys.add(id);
      state.keyCollected = true;
      // Blank out the tile so it disappears visually + logically for the loop.
      state.tiles[ty][tx] = ".";
    }
  } else if (t === "B") {
    // Boss trigger plate — persistent across loops. Once pressed by any actor,
    // stays pressed for the rest of the run.
    const id = `${tx},${ty}`;
    if (!state.bossPressed.has(id)) {
      state.bossPressed.add(id);
      state.tiles[ty][tx] = ".";
    }
  }
}

// ---------- Sentry logic ----------
// Sentries patrol between two tile waypoints at a fixed speed. If a dead echo
// body is in their forward path, they stall (creating the puzzle: sacrifice
// an echo to block a sentry).
function updateSentries(state: EngineState) {
  for (const s of state.sentries) {
    const ax = s.def.x0 * SIM.TILE + (SIM.TILE - SENTRY_W) / 2;
    const ay = s.def.y0 * SIM.TILE + (SIM.TILE - SENTRY_H) / 2;
    const bx = s.def.x1 * SIM.TILE + (SIM.TILE - SENTRY_W) / 2;
    const by = s.def.y1 * SIM.TILE + (SIM.TILE - SENTRY_H) / 2;
    const len = Math.hypot(bx - ax, by - ay);
    if (len <= 0) { s.stalled = false; continue; }

    // Advance phase; ping-pong at endpoints.
    const deltaPhase = s.def.speed / len;
    let candidate = s.phase + s.dir * deltaPhase;
    if (candidate >= 1) { candidate = 1; s.dir = -1; }
    if (candidate <= 0) { candidate = 0; s.dir = 1; }
    const candPx = ax + (bx - ax) * candidate;
    const candPy = ay + (by - ay) * candidate;

    // Check if a dead echo body blocks the sentry's next position.
    let blocked = false;
    for (const e of state.echoes) {
      if (e.alive) continue;
      if (aabbOverlap(candPx, candPy, SENTRY_W, SENTRY_H, e.x, e.y, PLAYER_W, PLAYER_H)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      s.stalled = true;
      // Do not advance phase — sentry waits at current position.
      continue;
    }
    s.stalled = false;
    s.phase = candidate;
    s.px = candPx;
    s.py = candPy;
  }
}

function sentryTouches(a: Actor, s: SentryState): boolean {
  return aabbOverlap(a.x, a.y, PLAYER_W, PLAYER_H, s.px, s.py, SENTRY_W, SENTRY_H);
}

// Detect ground contact: collision moving in the direction of gravity.
function moveY(state: EngineState, a: Actor, dy: number) {
  const steps = Math.ceil(Math.abs(dy));
  const step = steps === 0 ? 0 : dy / steps;
  for (let i = 0; i < steps; i++) {
    const ny = a.y + step;
    if (collidesBox(state, a.x, ny)) {
      // Ground when we hit a solid in the direction of gravity.
      if ((step > 0 && a.gravityDir > 0) || (step < 0 && a.gravityDir < 0)) {
        a.onGround = true;
      }
      a.vy = 0;
      return;
    }
    a.y = ny;
  }
}

// Detect which platform (if any) the actor is currently standing on.
// For flipped gravity, the actor's "feet" are the TOP of their AABB and the
// platform's supporting surface is the platform's BOTTOM edge.
function detectStandingOn(state: EngineState, a: Actor): string | null {
  if (!a.onGround) return null;
  const supportY = a.gravityDir === 1 ? a.y + PLAYER_H : a.y;
  for (const p of state.platforms) {
    const surface = a.gravityDir === 1 ? p.py : p.py + p.ph;
    if (Math.abs(supportY - surface) <= 2 &&
        a.x < p.px + p.pw && a.x + PLAYER_W > p.px) {
      return p.def.id;
    }
  }
  return null;
}

// ---------- Public step ----------

export function step(state: EngineState, playerInput: number): EngineState {
  if (state.status !== "playing") return state;

  updatePlatforms(state);
  carryActors(state);
  updateSentries(state);

  state.currentInputs[state.tick] = playerInput;

  for (let i = 0; i < state.echoes.length; i++) {
    const rec = state.recordings[i];
    const echoInput = rec.inputs[state.tick] || 0;
    stepActor(state, state.echoes[i], echoInput);
  }
  stepActor(state, state.player, playerInput);

  state.platesPressed = computePlates(state);
  state.beams = computeBeams(state);

  // Decrement any lingering death FX from a previous tick so the renderer
  // can fade the burst out smoothly. Max life = 24 ticks (~0.4s @ 60 TPS).
  if (state.deathFx && state.deathFx.fxTicksLeft > 0) {
    state.deathFx.fxTicksLeft -= 1;
    if (state.deathFx.fxTicksLeft <= 0) state.deathFx = null;
  }

  // Deaths: hazards + laser hits + sentries. We record the CAUSE and
  // position of the player's death so the renderer can play an electric
  // burst + screen flash — vital so players understand *why* they died.
  const allActors: Actor[] = [state.player, ...state.echoes];
  for (const a of allActors) {
    if (!a.alive) continue;
    const isPlayer = a === state.player;
    if (touchesHazard(state, a)) {
      a.alive = false;
      // Only overwrite FX on *player* death — echo deaths are less
      // dramatic and shouldn't flash the screen.
      if (isPlayer) {
        state.deathFx = {
          x: a.x + PLAYER_W / 2,
          y: a.y + PLAYER_H / 2,
          cause: "hazard",
          fxTicksLeft: 24,
          isPlayer: true,
        };
      }
      continue;
    }
    // Killed by beam if we're in the beam segment OR we are the terminator.
    let killed = false;
    for (const b of state.beams) {
      if (b.hitActor === a) { a.alive = false; killed = true; break; }
      const { bx, by, bw, bh } = beamAABB(b);
      if (aabbOverlap(a.x, a.y, PLAYER_W, PLAYER_H, bx, by, bw, bh)) { a.alive = false; killed = true; break; }
    }
    if (killed) {
      if (isPlayer) {
        state.deathFx = {
          x: a.x + PLAYER_W / 2,
          y: a.y + PLAYER_H / 2,
          cause: "beam",
          fxTicksLeft: 24,
          isPlayer: true,
        };
      }
      continue;
    }
    // Killed by an active sentry (only alive/moving sentries kill; stalled ones still kill on contact).
    for (const s of state.sentries) {
      if (sentryTouches(a, s)) {
        a.alive = false;
        if (isPlayer) {
          state.deathFx = {
            x: a.x + PLAYER_W / 2,
            y: a.y + PLAYER_H / 2,
            cause: "sentry",
            fxTicksLeft: 24,
            isPlayer: true,
          };
        }
        break;
      }
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

/**
 * Difficulty tier derived from the level's world. Worlds 1-4 are
 * tutorials & medium, worlds 5-6 introduce complex mechanics, 7-8 are
 * advanced/boss arenas. We use this to scale the star reward so beating
 * a world-8 boss feels more rewarding than clearing world-1-1.
 *
 *   Tier 1 → max 3 stars (easy)
 *   Tier 2 → max 4 stars (medium / hard)
 *   Tier 3 → max 5 stars (advanced / boss)
 */
export function difficultyTier(level: LevelDef): 1 | 2 | 3 {
  if (level.world >= 7) return 3;
  if (level.world >= 5) return 2;
  return 1;
}

/**
 * Maximum stars any player can earn on a given level — depends on tier.
 * Used by the Level Select UI to render the correct number of star slots.
 */
export function maxStarsForLevel(level: LevelDef): number {
  const t = difficultyTier(level);
  return t === 3 ? 5 : t === 2 ? 4 : 3;
}

/**
 * Convert a grade to the EARNED stars count for a specific level.
 *
 *   Base (grade→stars):   S=3  A=2  B=1  C=0
 *   Bonus from tier:      +1 star if tier ≥ 2,  +1 more if tier = 3
 *
 * So on a world-8 boss (tier 3) a perfect S-grade awards 5 stars; on a
 * world-1 beginner level (tier 1) the same perfect run awards 3 stars.
 * Clamped to each level's maxStars so the UI never overflows.
 */
export function gradeToStars(g: "S" | "A" | "B" | "C", level?: LevelDef): number {
  const base = g === "S" ? 3 : g === "A" ? 2 : g === "B" ? 1 : 0;
  if (!level) return Math.max(1, base);
  const t = difficultyTier(level);
  const bonus = t === 3 ? 2 : t === 2 ? 1 : 0;
  const max = maxStarsForLevel(level);
  // At least 1 star for any completion — losing C-grade on tier-3 would
  // otherwise give 0+2 = 2, which is fine, but we keep the min guard
  // for safety in case grade thresholds get re-tuned later.
  return Math.min(max, Math.max(1, base + bonus));
}

/**
 * Human-readable difficulty label for the level-select UI.
 * Keep words short — levels cards are tight on space on mobile.
 */
export function difficultyLabel(level: LevelDef): "Easy" | "Medium" | "Hard" | "Boss" {
  if (level.world >= 7) return level.world === 8 ? "Boss" : "Hard";
  if (level.world >= 5) return "Hard";
  if (level.world >= 3) return "Medium";
  return "Easy";
}

