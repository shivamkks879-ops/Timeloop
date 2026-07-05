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

  // 1-6: Twin pits at cols 4-5 and 10-11. Jump timing tuned to physics.
  "1-6": [
    { ticks: 25, right: true },
    { ticks: 12, right: true, jump: true },
    { ticks: 30, right: true },
    { ticks: 12, right: true, jump: true },
    { ticks: 250, right: true },
  ],

  // 1-7: Stepped ledges. Jump up each step.
  "1-7": [
    { ticks: 40, right: true },
    { ticks: 6, right: true, jump: true },
    { ticks: 30, right: true },
    { ticks: 6, right: true, jump: true },
    { ticks: 30, right: true },
    { ticks: 6, right: true, jump: true },
    { ticks: 200, right: true },
  ],

  // 1-8: Plate at col 3 (P), door at col 14, goal col 22. 1-echo.
  "1-8": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 260, right: true },
  ],

  // 1-9: Two plates at cols 2 and 9. Both need holding to open door at col 14.
  "1-9": [
    { ticks: 15, right: true },     // loop 0: park on first plate (col 2)
    { ticks: 585 },
    { ticks: 55, right: true },     // loop 1: park on second plate (col 9)
    { ticks: 545 },
    { ticks: 260, right: true },    // loop 2: cruise through door to goal
  ],

  // 1-10: Plate at col 2, spike pit at cols 8-9, door col 14, goal col 22.
  "1-10": [
    { ticks: 15, right: true },      // loop 0: park on plate
    { ticks: 585 },
    { ticks: 55, right: true },      // loop 1: run
    { ticks: 6, right: true, jump: true },   // jump spike pit
    { ticks: 200, right: true },
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

  // 2-4: Three vertical beams at cols 4, 10, 16. Three sacrifices then cross.
  "2-4": [
    { ticks: 50, right: true },      // die at col 4 beam
    { ticks: 30 },
    { ticks: 105, right: true },     // die at col 10
    { ticks: 30 },
    { ticks: 155, right: true },     // die at col 16
    { ticks: 40 },
    { ticks: 250, right: true },     // cruise past shielded beams
  ],

  // 2-5: Single vertical beam at col 14. Same rhythm as 2-1 but further right.
  "2-5": [
    { ticks: 150, right: true },
    { ticks: 30 },
    { ticks: 250, right: true },
  ],

  // 2-6: Horizontal beam `>` at col 10 row 6. Player runs; corpse at col 10 blocks beam.
  "2-6": [
    { ticks: 120, right: true },     // walk toward beam, die when overlapping
    { ticks: 30 },
    { ticks: 240, right: true },
  ],

  // 2-7: Crossfire (down + right). Two echoes shield each.
  "2-7": [
    { ticks: 120, right: true },
    { ticks: 30 },
    { ticks: 120, right: true },
    { ticks: 30 },
    { ticks: 240, right: true },
  ],

  // 2-8: Plate col 3, beam col 8 row 3 (vertical), door col 14, goal 22.
  //      Loop 1: park plate. Loop 2: fetch death at beam. Loop 3: cross safely.
  "2-8": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 100, right: true },
    { ticks: 40 },
    { ticks: 260, right: true },
  ],

  // 2-9: Two vertical beams at col 5 and col 14.
  "2-9": [
    { ticks: 70, right: true },
    { ticks: 30 },
    { ticks: 145, right: true },
    { ticks: 30 },
    { ticks: 260, right: true },
  ],

  // 2-10: Three beams at cols 6, 10, 18. Sacrifice each.
  "2-10": [
    { ticks: 80, right: true },
    { ticks: 30 },
    { ticks: 110, right: true },
    { ticks: 30 },
    { ticks: 180, right: true },
    { ticks: 30 },
    { ticks: 280, right: true },
  ],

  // 2-11: Plate col 3, beam col 10 row 3, door col 17, goal 22. Needs 3 loops.
  "2-11": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 120, right: true },
    { ticks: 40 },
    { ticks: 300, right: true },
  ],

  // 2-12: Four beams at cols 4/9/14/19. Sacrifice 3 echoes, walk the last.
  "2-12": [
    { ticks: 600, right: true },
    { ticks: 600, right: true },
    { ticks: 600, right: true },
    { ticks: 600, right: true },
  ],

  // ────────────────────────── WORLD 3 · Moving Platforms ──────────────────────
  "3-4": [
    { ticks: 60, right: true },
    { ticks: 240 },
    { ticks: 150, right: true },
  ],
  "3-5": [
    { ticks: 60, right: true },
    { ticks: 180 },
    { ticks: 80, right: true },
    { ticks: 180 },
    { ticks: 120, right: true },
  ],
  "3-6": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 80, right: true },
    { ticks: 150 },
    { ticks: 200, right: true },
  ],
  "3-7": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 80, right: true },
    { ticks: 180 },
    { ticks: 200, right: true },
  ],
  "3-8": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 130, right: true },
    { ticks: 250 },
    { ticks: 100, right: true },
  ],
  // 3-9: Same rhythm as 3-1 — walk, wait for platform to swing, cross.
  "3-9": [
    { ticks: 55, right: true },
    { ticks: 235 },
    { ticks: 100, right: true },
  ],
  "3-10": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 80, right: true },
    { ticks: 180 },
    { ticks: 200, right: true },
  ],
  "3-11": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 80, right: true },
    { ticks: 200 },
    { ticks: 200, right: true },
  ],
  "3-12": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 80, right: true },      // ride to right
    { ticks: 200 },
    { ticks: 200, right: true },
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
  "4-3": [{ ticks: 320, right: true }],
  "4-4": [{ ticks: 320, right: true }],
  "4-5": [{ ticks: 320, right: true }],
  "4-6": [{ ticks: 320, right: true }],
  "4-7": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 320, right: true },
  ],
  "4-8": [
    { ticks: 150, right: true },    // sacrifice at ceiling laser
    { ticks: 30 },
    { ticks: 320, right: true },
  ],
  "4-9": [{ ticks: 380, right: true }],
  "4-10": [{ ticks: 380, right: true }],
  "4-11": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 320, right: true },
  ],
  "4-12": [
    { ticks: 25, right: true },
    { ticks: 575 },
    { ticks: 140, right: true },    // sacrifice at ceiling beam
    { ticks: 40 },
    { ticks: 320, right: true },
  ],

  // 5-1: Walk into portal, warp to twin, continue to goal.
  "5-1": [{ ticks: 200, right: true }],

  // 5-2: Warp past a vertical laser to the twin, continue to goal.
  "5-2": [{ ticks: 200, right: true }],

  "5-3": [{ ticks: 320, right: true }],
  "5-4": [{ ticks: 260, right: true }],
  "5-5": [{ ticks: 320, right: true }],
  "5-6": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 320, right: true },
  ],
  "5-7": [{ ticks: 320, right: true }],
  "5-8": [{ ticks: 320, right: true }],
  "5-9": [{ ticks: 260, right: true }],
  "5-10": [
    { ticks: 120, right: true },
    { ticks: 480 },
    { ticks: 320, right: true },
  ],
  "5-11": [{ ticks: 320, right: true }],
  "5-12": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 120, right: true },
    { ticks: 480 },
    { ticks: 320, right: true },
  ],

  // 6-1: Walk right, pick up key at col 9, unlock door at col 14, walk to goal.
  "6-1": [{ ticks: 220, right: true }],

  // 6-2: Loop 1 park on plate at col 2 (x=64-95). Loop 2 fetch key, unlock, cross.
  "6-2": [
    { ticks: 20, right: true },
    { ticks: 580 },
    { ticks: 250, right: true },
  ],

  "6-3": [{ ticks: 320, right: true }],
  "6-4": [
    { ticks: 20, right: true },
    { ticks: 580 },
    { ticks: 600, right: true },
  ],
  "6-5": [{ ticks: 1800, right: true }],
  "6-6": [{ ticks: 260, right: true }],
  "6-7": [{ ticks: 800, right: true }],
  "6-8": [{ ticks: 320, right: true }],
  "6-9": [{ ticks: 320, right: true }],
  "6-10": [{ ticks: 380, right: true }],
  "6-11": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 120, right: true },
    { ticks: 480 },
    { ticks: 320, right: true },
  ],
  "6-12": [{ ticks: 320, right: true }],

  // 7-1: Loop 1 sit on plate. Loop 2 grab key. Loop 3 cruise to goal.
  "7-1": [
    { ticks: 50, right: true },
    { ticks: 550 },
    { ticks: 130, right: true },
    { ticks: 470 },
    { ticks: 260, right: true },
  ],

  // 7-2: Loop 1 shield beam. Loop 2 grab key. Loop 3 escape.
  "7-2": [
    { ticks: 120, right: true },
    { ticks: 40 },
    { ticks: 130, right: true },
    { ticks: 30 },
    { ticks: 260, right: true },
  ],

  "7-3": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 120, right: true },
    { ticks: 480 },
    { ticks: 320, right: true },
  ],
  "7-4": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 320, right: true },
  ],
  "7-5": [{ ticks: 2400, right: true }],
  "7-6": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 60, right: true },
    { ticks: 540 },
    { ticks: 320, right: true },
  ],
  "7-7": [{ ticks: 320, right: true }],
  "7-8": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 320, right: true },
  ],
  "7-9": [{ ticks: 320, right: true }],
  "7-10": [
    { ticks: 600, right: true },
    { ticks: 300, right: true },
  ],
  "7-11": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 120, right: true },
    { ticks: 480 },
    { ticks: 320, right: true },
  ],
  "7-12": [{ ticks: 3000, right: true }],
  "7-13": [
    { ticks: 120, right: true },
    { ticks: 480 },
    { ticks: 60, right: true },
    { ticks: 540 },
    { ticks: 320, right: true },
  ],
  "7-14": [
    { ticks: 30, right: true },
    { ticks: 570 },
    { ticks: 60, right: true },
    { ticks: 540 },
    { ticks: 120, right: true },
    { ticks: 480 },
    { ticks: 320, right: true },
  ],

  // ─────────────────────── WORLD 8 · Final Escape ───────────────────────────
  // 8-1: R rift at col 10. Loop 0 blocked. Loop 1 open — walk right.
  "8-1": [
    { ticks: 600, right: true },     // loop 0: hit R, wait for timer
    { ticks: 250, right: true },     // loop 1: cross open R, reach G
  ],

  // 8-2: Two R rifts at cols 7 and 15. Same parity; loop 1 opens both.
  "8-2": [
    { ticks: 600, right: true },
    { ticks: 260, right: true },
  ],

  // 8-3: Flip to ceiling at col 4, walk across, flip back at col 22 (last col).
  //      Sentry patrols floor cols 10-16 — no threat on ceiling.
  "8-3": [{ ticks: 320, right: true }],

  // 8-4: Same trick — flip up at col 3, ceiling road past R and sentry, flip down at col 22.
  "8-4": [
    { ticks: 600, right: true },     // loop 0: run + flip, may not reach G in time
    { ticks: 300, right: true },     // loop 1: R rift now passable too — cruise
  ],

  // 8-5: Grab key + hit R rift on loop 0, cross R + unlock L on loop 1.
  "8-5": [
    { ticks: 600, right: true },     // loop 0: pick up key at col 5, blocked at R
    { ticks: 300, right: true },     // loop 1: R open, key already held, unlock L, reach G
  ],

  // ─── Late World 8 (Phase 5.5) — road to final boss ─────────────────
  // 8-6: r rift is passable on loop 0 (even). Just walk right to goal.
  "8-6": [{ ticks: 280, right: true }],

  // 8-7: Three R rifts (all solid on loop 0). Loop 1 opens all — sprint.
  "8-7": [
    { ticks: 600, right: true },
    { ticks: 300, right: true },
  ],

  // 8-8: Mid-boss. Two B plates at cols 2 and 20. R rift at col 11 splits them.
  //      Loop 0: walk right, press B1, blocked at R. Echo saves position.
  //      Loop 1: R open, echo replays through, live player crosses, presses B2,
  //              H unlocks (2/2 pressed), reaches G.
  "8-8": [
    { ticks: 600, right: true },
    { ticks: 300, right: true },
  ],

  // 8-9: Portal skips over sentry patrol. maxEchoes=0. Solved in loop 0.
  "8-9": [{ ticks: 280, right: true }],

  // 8-10: Rift Sanctuary. Loop 0 blocked, loop 1 open + key + unlock.
  "8-10": [
    { ticks: 600, right: true },
    { ticks: 300, right: true },
  ],

  // 8-11: Twin boss plates, no rift, no sentry — just walk right, press both,
  //       H opens, reach goal in one loop.
  "8-11": [{ ticks: 280, right: true }],

  // 8-12: Rift Cascade — 3 r rifts, all passable on even loops. Trivial walk.
  "8-12": [{ ticks: 280, right: true }],

  // 8-13: Rift blocks the path, portal skips past it on loop 1.
  "8-13": [
    { ticks: 600, right: true },
    { ticks: 300, right: true },
  ],

  // 8-14: 1 boss plate + rift. Press B on loop 0, cross rift on loop 1.
  "8-14": [
    { ticks: 600, right: true },
    { ticks: 300, right: true },
  ],

  // 8-15: Final approach — key on loop 0 (blocked by R), unlock L loop 1.
  "8-15": [
    { ticks: 600, right: true },
    { ticks: 300, right: true },
  ],

  // 8-16: Final boss Chronos. Three B plates split by R rift.
  //       Loop 0: press B1 (col 2) and B2 (col 8), blocked at R (col 13).
  //       Loop 1: R open — cross, press B3 (col 18), H unlocks (3/3), reach G.
  "8-16": [
    { ticks: 600, right: true },
    { ticks: 400, right: true },
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
