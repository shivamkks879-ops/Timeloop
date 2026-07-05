// Robot skin variants — pure color palette swaps applied to the vector
// character. Each skin has an unlock condition based on progress.
//
// Skins do NOT affect the simulation — they are purely cosmetic and safe
// to change mid-game.

import { LEVELS } from "./levels";
import type { SaveData } from "./types";

export interface Skin {
  id: string;
  name: string;
  bodyMain: string;
  bodyShade: string;
  visor: string;
  accent: string;
  // Free-form condition string shown when locked.
  unlock: string;
  // Predicate to run against the save data. Returns true when unlocked.
  isUnlockedByProgress: (save: SaveData) => boolean;
}

// Helper — count number of S-graded levels in save.
function sGradeCount(save: SaveData): number {
  let n = 0;
  for (const id of Object.keys(save.levels)) {
    if (save.levels[id].grade === "S") n++;
  }
  return n;
}

// Helper — worlds-completed count (all levels in a world graded ≥ B).
function worldsCleared(save: SaveData): number {
  const byWorld: Record<number, boolean[]> = {};
  for (const l of LEVELS) {
    const done = save.levels[l.id]?.completed === true;
    if (!byWorld[l.world]) byWorld[l.world] = [];
    byWorld[l.world].push(done);
  }
  let n = 0;
  for (const w of Object.keys(byWorld)) {
    if (byWorld[+w].every(Boolean)) n++;
  }
  return n;
}

export const SKINS: Skin[] = [
  {
    id: "cyan",
    name: "Prototype",
    bodyMain: "#F0F5FF",
    bodyShade: "#4A5468",
    visor: "#00E5FF",
    accent: "#00E5FF",
    unlock: "Starter skin",
    isUnlockedByProgress: () => true,
  },
  {
    id: "gold",
    name: "Warden Gold",
    bodyMain: "#FFE7A6",
    bodyShade: "#8A6A00",
    visor: "#FFB800",
    accent: "#FFD54D",
    unlock: "Clear all of World 1",
    isUnlockedByProgress: (s) => worldsCleared(s) >= 1,
  },
  {
    id: "emerald",
    name: "Verdant Echo",
    bodyMain: "#C6FFE0",
    bodyShade: "#0A5A38",
    visor: "#00FF88",
    accent: "#00FF88",
    unlock: "Earn 10 S-grades",
    isUnlockedByProgress: (s) => sGradeCount(s) >= 10,
  },
  {
    id: "violet",
    name: "Chrono Wraith",
    bodyMain: "#E9D2FF",
    bodyShade: "#4A0080",
    visor: "#B266FF",
    accent: "#9D00FF",
    unlock: "Clear all of World 4",
    isUnlockedByProgress: (s) => worldsCleared(s) >= 4,
  },
  {
    id: "crimson",
    name: "Ember Runner",
    bodyMain: "#FFD1CE",
    bodyShade: "#7A1010",
    visor: "#FF5A3C",
    accent: "#FF003C",
    unlock: "Earn 40 S-grades",
    isUnlockedByProgress: (s) => sGradeCount(s) >= 40,
  },
  {
    id: "cosmic",
    name: "Chronos Prime",
    bodyMain: "#F5F5FF",
    bodyShade: "#1A1A48",
    visor: "#FFFFFF",
    accent: "#F5A800",
    unlock: "Defeat CHRONOS (clear 8-16 with S-grade)",
    isUnlockedByProgress: (s) => s.levels["8-16"]?.grade === "S",
  },
];

export function getSkinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

// Read from the cached save and return the *effective* skin (falls back to
// starter if the saved id is somehow missing).
import { getCachedSave } from "./save";
export function getCurrentSkin(): Skin {
  const save = getCachedSave();
  const s = SKINS.find((sk) => sk.id === save.selectedSkin);
  return s ?? SKINS[0];
}

// Given the current save, return the list of skin ids that *should* be
// unlocked based on progress. Callers can persist these into the save.
export function unlockedByProgress(save: SaveData): string[] {
  return SKINS.filter((s) => s.isUnlockedByProgress(save)).map((s) => s.id);
}
