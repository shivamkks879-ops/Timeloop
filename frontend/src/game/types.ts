// Shared game types

export type TileChar =
  | "." | "#" | "S" | "G" | "^" | "P" | "D"
  | "<" | ">" | "n" | "v"
  | "~" | "1" | "2"
  | "k" | "L"                       // key · locked door
  | "R" | "r"                       // Time Rift phase 0 · phase 1
  | "B"                             // Boss trigger plate (persistent across loops)
  | "H";                            // Boss-locked door: opens when ALL B plates in the level have been pressed

export interface Laser {
  tx: number;
  ty: number;
  dir: "left" | "right" | "up" | "down";
}

export interface MovingPlatformDef {
  id: string;
  x0: number; y0: number;
  x1: number; y1: number;
  width: number;
  height: number;
  speed: number;
  trigger: "plate" | "always";
}

// Warden sentry — patrols between waypoints. Kills alive actors on contact.
// Can be stopped ("stalled") by a dead echo body blocking its path — this is
// how the no-combat puzzle language lets the player disable a sentry.
export interface SentryDef {
  id: string;
  x0: number; y0: number;           // waypoint A (tile coords)
  x1: number; y1: number;           // waypoint B (tile coords)
  speed: number;                    // pixels / tick
  phase0?: number;                  // 0..1 initial phase (default 0)
}

export interface SentryState {
  def: SentryDef;
  phase: number;                    // 0..1 along waypoint segment
  dir: 1 | -1;                      // ping-pong direction
  px: number;                       // current top-left x (pixels)
  py: number;                       // current top-left y (pixels)
  stalled: boolean;                 // blocked by dead echo this tick
}

export interface LevelDef {
  id: string;
  name: string;
  hint: string;
  world: number;
  grid: string[];
  maxEchoes: number;
  parEchoes: number;
  platforms?: MovingPlatformDef[];
  sentries?: SentryDef[];
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  wallDir: number;
  coyote: number;
  buffer: number;
  wallLock: number;
  alive: boolean;
  facing: number;
  standingOn: string | null;
  gravityDir: 1 | -1;                // 1 = gravity down; -1 = gravity up
  flipCd: number;                    // ticks of flip cooldown
  teleCd: number;                    // ticks of teleport cooldown
}

export interface EchoRecording {
  inputs: Uint8Array;
  spawnX: number;
  spawnY: number;
}

export interface PlatformState {
  def: MovingPlatformDef;
  phase: number;                    // 0..1 (0 = at start, 1 = at end)
  osciDir: 1 | -1;                  // for "always" trigger oscillation direction
  px: number;                       // current top-left x (pixels)
  py: number;                       // current top-left y (pixels)
  pw: number;                       // pixel width
  ph: number;                       // pixel height
  dx: number;                       // delta this tick
  dy: number;                       // delta this tick
}

export interface LaserBeam {
  laser: Laser;
  x1: number; y1: number;
  x2: number; y2: number;
  hitActor: PlayerState | null;     // the alive/dead actor that terminates this beam
}

export type GameStatus = "playing" | "won" | "dead";

export interface LevelSave {
  completed: boolean;
  bestEchoes: number;
  grade: "S" | "A" | "B" | "C" | null;
  stars: number;
}

export interface SaveData {
  levels: Record<string, LevelSave>;
  removeAds: boolean;
  audioOn: boolean;
  hapticsOn: boolean;
  oneThumb: boolean;
  screenShake: boolean;
  selectedSkin: string;             // id of the selected robot skin
  unlockedSkins: string[];          // ids of unlocked skin variants
  achievements: string[];           // ids of unlocked achievements
}
