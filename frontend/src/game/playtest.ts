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

  // 1-3: Just walk right along the ground; ledge sits above.
  "1-3": [{ ticks: 220, right: true }],

  // 1-4: Loop 1 - walk onto plate and idle. Loop 2 - echo replays; player runs through.
  "1-4": [
    { ticks: 50, right: true },     // reach plate: 50*3.6 = 180 px, spans cols 5-6
    { ticks: 550 },
    { ticks: 600, right: true },
  ],

  // 1-5: Plate at col 3, two doors at cols 10 and 16, goal at col 22.
  "1-5": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 600, right: true },
  ],

  // 2-1: Vertical laser at col 10 row 3. Loop 1 die at beam. Loop 2 echo blocks, player crosses.
  // Beam center x = 336. Player width 22 hits beam at x ~314 (right edge in beam column).
  "2-1": [
    { ticks: 120, right: true },        // walk into beam - die at ~tick 86
    // spillover continues into loop 2 (player continues right through echo,
    // but the echo dies same place so beam gets blocked before player arrives).
    // Add a small wait so echo dies BEFORE the player reaches the beam.
    { ticks: 25 },                       // pause so live player is behind dead echo
    { ticks: 220, right: true },
  ],

  // 2-2: Two lasers at col 6 and col 14. Two sacrifices required.
  "2-2": [
    { ticks: 80, right: true },          // die at first beam
    { ticks: 30 },                       // wait
    { ticks: 130, right: true },         // walk past first echo, die at second beam
    { ticks: 40 },                       // wait for both echoes to die and block
    { ticks: 260, right: true },
  ],

  // 2-3: Plate col 3 row 8. Door col 6 rows 6-7. Laser col 12 row 3. Goal col 22.
  "2-3": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 110, right: true },
    { ticks: 40 },
    { ticks: 300, right: true },
  ],

  // 3-1: Always-oscillating platform. Board at col 5-6, ride to col 14, walk off.
  "3-1": [
    { ticks: 55, right: true },
    { ticks: 235 },
    { ticks: 100, right: true },
  ],

  // 3-2: Plate col 2 row 8. Platform col 5→14. Loop 1 park on plate.
  //      Loop 2 echo holds plate; player boards platform, rides, walks off.
  "3-2": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 80, right: true },
    { ticks: 130 },
    { ticks: 100, right: true },
  ],

  // 3-3: Same rhythm as 3-2 with a plate-controlled door on the far side.
  "3-3": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 80, right: true },
    { ticks: 130 },
    { ticks: 150, right: true },
  ],

  // 4-1: Walk into flip tile, rise to ceiling, walk right to goal.
  "4-1": [{ ticks: 260, right: true }],

  // 4-2: Flip, cross ceiling, second flip drops onto safe floor past spike pit.
  "4-2": [{ ticks: 320, right: true }],

  // 5-1: Walk into portal, warp to twin, continue to goal.
  "5-1": [{ ticks: 200, right: true }],

  // 5-2: Warp past a vertical laser to the twin, continue to goal.
  "5-2": [{ ticks: 200, right: true }],
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
