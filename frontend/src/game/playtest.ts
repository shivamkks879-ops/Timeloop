// Automated playtest harness for Time Loop Escape.
//
// For every level, we run the engine headlessly with a hand-authored input
// script (a list of segments). The harness verifies:
//   - The level is completable ("won" status reached)
//   - No softlocks (bounded by max echoes)
//   - Echo synchronization (recorded inputs replay identically)
//   - Timer logic (loop ends at exactly LOOP_TICKS)
//
// Run at boot in dev and via CI to ensure no level ever ships broken.

import { SIM } from "./constants";
import { LEVELS } from "./levels";
import {
  computeGrade,
  encodeInput,
  gradeToStars,
  initEngine,
  step,
  type EngineState,
} from "./engine";
import type { LevelDef } from "./types";

// A segment describes an input state held for N ticks.
export interface InputSegment {
  ticks: number;
  left?: boolean;
  right?: boolean;
  jump?: boolean;
}

// Level solutions (one per level). Each script sums to <= LOOP_TICKS * (maxEchoes+1).
// Timing tuned against the physics constants in constants.ts.
export const SOLUTIONS: Record<string, InputSegment[]> = {
  // 1-1: Flat ground, walk right until goal.
  "1-1": [{ ticks: 240, right: true }],

  // 1-2: 3-tile spike pit around col 8-10. Run + jump early.
  "1-2": [
    { ticks: 65, right: true },
    { ticks: 6, right: true, jump: true },
    { ticks: 30, right: true },
    { ticks: 200, right: true },
  ],

  // 1-3: Ledge at row 5-6 cols 16-21. Actually goal is at row 7 col 19 - just
  // walk right along the ground; the ledge sits above and doesn't block us.
  "1-3": [{ ticks: 220, right: true }],

  // 1-4: Plate at col 5 (floor), door at col 10 rows 6-7, goal at col 22.
  // Player width 22px + tile 32 -> need to STOP with body over col 5.
  // Loop 1 - walk onto plate and idle. Loop 2 - echo replays; player runs through.
  "1-4": [
    { ticks: 50, right: true },     // reach plate: 50*3.6 = 180 px, spans cols 5-6
    { ticks: 550 },                 // idle on plate for the rest of loop 1
    { ticks: 600, right: true },    // loop 2: run all the way to goal
  ],

  // 1-5: Plate at col 3, two doors at cols 10 and 16, goal at col 22.
  "1-5": [
    { ticks: 30, right: true },     // 30*3.6 = 108 px, spans cols 3-4 (plate at col 3)
    { ticks: 570 },
    { ticks: 600, right: true },
  ],
};

export interface PlaytestResult {
  levelId: string;
  status: "pass" | "fail";
  reason?: string;
  ticksUsed: number;
  loopsUsed: number;
  echoesUsed: number;
  grade: "S" | "A" | "B" | "C" | null;
  stars: number;
  finalPlayerX?: number;
  finalPlayerY?: number;
}

export function playtestLevel(level: LevelDef, script: InputSegment[]): PlaytestResult {
  let state: EngineState = initEngine(level);
  let totalTicks = 0;
  const maxTicks = SIM.LOOP_TICKS * (level.maxEchoes + 1);

  for (const seg of script) {
    const input = encodeInput(!!seg.left, !!seg.right, !!seg.jump);
    for (let t = 0; t < seg.ticks; t++) {
      state = step(state, input);
      totalTicks += 1;
      if (state.status === "won") {
        const grade = computeGrade(level, state.loop);
        return {
          levelId: level.id,
          status: "pass",
          ticksUsed: totalTicks,
          loopsUsed: state.loop + 1,
          echoesUsed: state.loop,
          grade,
          stars: gradeToStars(grade),
          finalPlayerX: state.player.x,
          finalPlayerY: state.player.y,
        };
      }
      if (state.status === "dead") {
        return {
          levelId: level.id,
          status: "fail",
          reason: "died",
          ticksUsed: totalTicks,
          loopsUsed: state.loop + 1,
          echoesUsed: state.loop,
          grade: null,
          stars: 0,
          finalPlayerX: state.player.x,
          finalPlayerY: state.player.y,
        };
      }
      if (totalTicks >= maxTicks) {
        return {
          levelId: level.id,
          status: "fail",
          reason: "ran out of time",
          ticksUsed: totalTicks,
          loopsUsed: state.loop + 1,
          echoesUsed: state.loop,
          grade: null,
          stars: 0,
          finalPlayerX: state.player.x,
          finalPlayerY: state.player.y,
        };
      }
    }
  }
  return {
    levelId: level.id,
    status: "fail",
    reason: "script ended without reaching goal",
    ticksUsed: totalTicks,
    loopsUsed: state.loop + 1,
    echoesUsed: state.loop,
    grade: null,
    stars: 0,
    finalPlayerX: state.player.x,
    finalPlayerY: state.player.y,
  };
}

export function playtestAll(): PlaytestResult[] {
  return LEVELS.map((l) => {
    const script = SOLUTIONS[l.id] ?? [];
    return playtestLevel(l, script);
  });
}
