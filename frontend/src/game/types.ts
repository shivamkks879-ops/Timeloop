// Shared game types

export type TileChar =
  | "." | "#" | "S" | "G" | "^" | "P" | "D" | "="; // "=" = one-way platform (future)

export interface LevelDef {
  id: string;
  name: string;
  hint: string;
  world: number;
  grid: string[];         // rows of tiles, top -> bottom
  maxEchoes: number;      // echo budget (levels can require >=1 echo)
  parEchoes: number;      // for grading S = <=par
}

export interface PlayerState {
  x: number;              // logical pixels
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  wallDir: number;        // -1 wall on left, 1 wall on right, 0 none
  coyote: number;         // remaining coyote ticks
  buffer: number;         // remaining jump-buffer ticks
  wallLock: number;       // remaining wall-jump lock (ignores horizontal input)
  alive: boolean;
  facing: number;         // -1 or 1
}

export interface EchoRecording {
  inputs: Uint8Array;     // length = LOOP_TICKS
  spawnX: number;
  spawnY: number;
}

export type GameStatus = "playing" | "won" | "dead";

export interface LevelSave {
  completed: boolean;
  bestEchoes: number;     // fewer is better
  grade: "S" | "A" | "B" | "C" | null;
  stars: number;          // 0..3
}

export interface SaveData {
  levels: Record<string, LevelSave>;
  removeAds: boolean;
  audioOn: boolean;
  hapticsOn: boolean;
}
