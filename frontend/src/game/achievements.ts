// Achievement definitions + progress check helper.
//
// Achievements are pure metadata: a static list, plus a predicate that runs
// against the current SaveData to determine if the achievement is earned.
// The main game loop calls `evaluateAchievements(save)` after each level
// result to unlock any newly-satisfied achievements.

import { LEVELS } from "./levels";
import type { SaveData } from "./types";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;              // single emoji or unicode glyph (kept minimal)
  isEarned: (save: SaveData) => boolean;
}

function sCount(save: SaveData) {
  return Object.values(save.levels).filter((l) => l.grade === "S").length;
}
function completedCount(save: SaveData) {
  return Object.values(save.levels).filter((l) => l.completed).length;
}
function worldCompleted(save: SaveData, world: number) {
  const inWorld = LEVELS.filter((l) => l.world === world);
  if (inWorld.length === 0) return false;
  return inWorld.every((l) => save.levels[l.id]?.completed === true);
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_steps",
    name: "First Steps",
    description: "Complete your very first level.",
    icon: "\u2605",
    isEarned: (s) => completedCount(s) >= 1,
  },
  {
    id: "world1",
    name: "Learning Time",
    description: "Complete every level in World 1.",
    icon: "\u25C6",
    isEarned: (s) => worldCompleted(s, 1),
  },
  {
    id: "world4",
    name: "Gravity Master",
    description: "Complete every level in World 4.",
    icon: "\u21C4",
    isEarned: (s) => worldCompleted(s, 4),
  },
  {
    id: "world8",
    name: "Escape Artist",
    description: "Complete every level in World 8.",
    icon: "\u2734",
    isEarned: (s) => worldCompleted(s, 8),
  },
  {
    id: "s_10",
    name: "Sharp Reflexes",
    description: "Earn 10 S-grades.",
    icon: "\u26A1",
    isEarned: (s) => sCount(s) >= 10,
  },
  {
    id: "s_40",
    name: "Time Bender",
    description: "Earn 40 S-grades.",
    icon: "\u25C8",
    isEarned: (s) => sCount(s) >= 40,
  },
  {
    id: "s_100",
    name: "Chronomancer",
    description: "Earn an S-grade on every level.",
    icon: "\u2726",
    isEarned: (s) => sCount(s) >= 100,
  },
  {
    id: "chronos_slain",
    name: "Chronos Slain",
    description: "Defeat CHRONOS with an S-grade on level 8-16.",
    icon: "\u2620",
    isEarned: (s) => s.levels["8-16"]?.grade === "S",
  },
  {
    id: "no_deaths",
    name: "Perfect Loop",
    description: "Clear ANY level using zero echoes (par 0).",
    icon: "\u25EF",
    isEarned: (s) => Object.values(s.levels).some((l) => l.completed && l.bestEchoes === 0),
  },
  {
    id: "all_worlds",
    name: "Full Circuit",
    description: "Complete every level in every world.",
    icon: "\u2733",
    isEarned: (s) => completedCount(s) >= LEVELS.length,
  },
];

// Return the list of achievement ids currently earned per the save data.
export function earnedAchievements(save: SaveData): string[] {
  return ACHIEVEMENTS.filter((a) => a.isEarned(save)).map((a) => a.id);
}
