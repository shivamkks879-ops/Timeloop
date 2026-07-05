// World 1 - Learning Time: 5 tutorial levels.
// Tile chars: . empty, # solid, S spawn, G goal, ^ spike, P plate (walkable),
//             D door (solid unless a plate is pressed)
// Every level is intentionally simple - one new idea per level.
// Widths are 24, heights 10 (fits landscape at 32px/tile -> 768x320 logical).
// All levels are validated by scripts/playtest.js on every commit.

import { LevelDef } from "./types";

export const LEVELS: LevelDef[] = [
  {
    id: "1-1",
    name: "First Steps",
    hint: "Slide your thumb right to move. Reach the portal.",
    world: 1,
    maxEchoes: 0,
    parEchoes: 0,
    grid: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "S......................G",
      "########################",
      "########################",
    ],
  },
  {
    id: "1-2",
    name: "Leap of Faith",
    hint: "Tap Jump to leap the pit. Release early for a shorter hop.",
    world: 1,
    maxEchoes: 0,
    parEchoes: 0,
    grid: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "S......................G",
      "########^^^#############",
      "########################",
    ],
  },
  {
    id: "1-3",
    name: "High Ground",
    hint: "Jump onto the ledge to reach the exit above.",
    world: 1,
    maxEchoes: 0,
    parEchoes: 0,
    grid: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "................######..",
      "................######..",
      "S..................G....",
      "########################",
      "########################",
    ],
  },
  {
    id: "1-4",
    name: "Echo Bridge",
    hint: "Your Echo holds the switch to open the door.",
    world: 1,
    maxEchoes: 1,
    parEchoes: 1,
    grid: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "..........D.............",
      "S.........D...........G.",
      "#####P##################",
      "########################",
    ],
  },
  {
    id: "1-5",
    name: "Two Timing",
    hint: "Loop 1: stand on the plate. Loop 2: cross through the door.",
    world: 1,
    maxEchoes: 1,
    parEchoes: 1,
    grid: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "..........D.....D.......",
      "..........D.....D.......",
      "S.........D.....D.....G.",
      "###P####################",
      "########################",
    ],
  },
];

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id);
}

export function nextLevelId(id: string): string | null {
  const i = levelIndex(id);
  if (i < 0 || i >= LEVELS.length - 1) return null;
  return LEVELS[i + 1].id;
}
