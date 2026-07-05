// Save system - backed by AsyncStorage via the project's storage util.
// Stores per-level completion, grades, and player preferences.

import { storage } from "@/src/utils/storage";

import { LEVELS } from "./levels";
import type { LevelSave, SaveData } from "./types";

const KEY = "tle.save.v1";

function emptySave(): SaveData {
  const levels: Record<string, LevelSave> = {};
  for (const l of LEVELS) {
    levels[l.id] = { completed: false, bestEchoes: Infinity, grade: null, stars: 0 };
  }
  return { levels, removeAds: false, audioOn: true, hapticsOn: true };
}

// In-memory cache so screens can read synchronously after first load.
let cache: SaveData | null = null;

export async function loadSave(): Promise<SaveData> {
  if (cache) return cache;
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) {
    cache = emptySave();
    return cache;
  }
  try {
    const parsed = JSON.parse(raw) as SaveData;
    // Merge with empty save to backfill any new levels
    const base = emptySave();
    cache = {
      ...base,
      ...parsed,
      levels: { ...base.levels, ...parsed.levels },
    };
    return cache;
  } catch {
    cache = emptySave();
    return cache;
  }
}

export function getCachedSave(): SaveData {
  return cache ?? emptySave();
}

export async function persistSave(data: SaveData): Promise<void> {
  cache = data;
  await storage.setItem(KEY, JSON.stringify(data));
}

export async function recordLevelResult(
  levelId: string,
  echoesUsed: number,
  grade: "S" | "A" | "B" | "C",
  stars: number
): Promise<SaveData> {
  const data = await loadSave();
  const prev = data.levels[levelId] ?? {
    completed: false,
    bestEchoes: Infinity,
    grade: null,
    stars: 0,
  };
  const better = !prev.completed || stars > prev.stars || echoesUsed < prev.bestEchoes;
  data.levels[levelId] = {
    completed: true,
    bestEchoes: Math.min(prev.bestEchoes, echoesUsed),
    grade: better ? grade : prev.grade,
    stars: Math.max(prev.stars, stars),
  };
  await persistSave(data);
  return data;
}

export function isLevelUnlocked(data: SaveData, levelId: string): boolean {
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  if (idx <= 0) return true;
  const prev = LEVELS[idx - 1];
  return data.levels[prev.id]?.completed === true;
}

export async function setAudio(on: boolean) {
  const data = await loadSave();
  data.audioOn = on;
  await persistSave(data);
}
export async function setHaptics(on: boolean) {
  const data = await loadSave();
  data.hapticsOn = on;
  await persistSave(data);
}
export async function setRemoveAds(on: boolean) {
  const data = await loadSave();
  data.removeAds = on;
  await persistSave(data);
}
