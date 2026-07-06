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
  return {
    levels,
    removeAds: false,
    audioOn: true,
    musicOn: true,
    sfxOn: true,
    hapticsOn: true,
    oneThumb: false,
    screenShake: true,
    colorSafe: false,
    controlOpacity: 0.85,
    selectedSkin: "cyan",
    unlockedSkins: ["cyan"],
    achievements: [],
    stats: {
      totalDeaths: 0,
      totalEchoes: 0,
      totalPlaytimeMs: 0,
      totalLevelsCompleted: 0,
      fastestClearMs: null,
    },
  };
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
    // Merge with empty save to backfill any new levels / new top-level keys
    // added between versions (e.g. `stats` for older saves).
    const base = emptySave();
    cache = {
      ...base,
      ...parsed,
      levels: { ...base.levels, ...parsed.levels },
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
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
  stars: number,
  clearMs?: number,
): Promise<SaveData> {
  const data = await loadSave();
  const prev = data.levels[levelId] ?? {
    completed: false,
    bestEchoes: Infinity,
    grade: null,
    stars: 0,
  };
  const better = !prev.completed || stars > prev.stars || echoesUsed < prev.bestEchoes;
  const wasCompleted = prev.completed;
  data.levels[levelId] = {
    completed: true,
    bestEchoes: Math.min(prev.bestEchoes, echoesUsed),
    grade: better ? grade : prev.grade,
    stars: Math.max(prev.stars, stars),
  };
  // Lifetime stats: bump counters even on repeat clears.
  data.stats.totalEchoes += echoesUsed;
  if (!wasCompleted) data.stats.totalLevelsCompleted += 1;
  if (typeof clearMs === "number" && clearMs > 0) {
    if (data.stats.fastestClearMs === null || clearMs < data.stats.fastestClearMs) {
      data.stats.fastestClearMs = clearMs;
    }
  }
  // Auto-unlock any newly-earned skins and achievements based on updated
  // progress. Both lookups are pure functions of the save data.
  const { unlockedByProgress } = await import("./skins");
  const newSkins = unlockedByProgress(data);
  for (const id of newSkins) {
    if (!data.unlockedSkins.includes(id)) data.unlockedSkins = [...data.unlockedSkins, id];
  }
  const { earnedAchievements } = await import("./achievements");
  const earned = earnedAchievements(data);
  for (const id of earned) {
    if (!data.achievements.includes(id)) data.achievements = [...data.achievements, id];
  }
  await persistSave(data);
  return data;
}

export async function bumpDeathStat() {
  const data = await loadSave();
  data.stats.totalDeaths += 1;
  await persistSave(data);
}

export async function bumpPlaytime(ms: number) {
  if (!ms || ms <= 0) return;
  const data = await loadSave();
  data.stats.totalPlaytimeMs += ms;
  await persistSave(data);
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

export async function setOneThumb(on: boolean) {
  const data = await loadSave();
  data.oneThumb = on;
  await persistSave(data);
}
export async function setScreenShake(on: boolean) {
  const data = await loadSave();
  data.screenShake = on;
  await persistSave(data);
}
export async function setMusicOn(on: boolean) {
  const data = await loadSave();
  data.musicOn = on;
  await persistSave(data);
}
export async function setSfxOn(on: boolean) {
  const data = await loadSave();
  data.sfxOn = on;
  await persistSave(data);
}
export async function setColorSafe(on: boolean) {
  const data = await loadSave();
  data.colorSafe = on;
  await persistSave(data);
}
export async function setControlOpacity(v: number) {
  const data = await loadSave();
  data.controlOpacity = Math.max(0.4, Math.min(1, v));
  await persistSave(data);
}
export async function setSelectedSkin(id: string) {
  const data = await loadSave();
  data.selectedSkin = id;
  await persistSave(data);
}
export async function unlockSkin(id: string) {
  const data = await loadSave();
  if (!data.unlockedSkins.includes(id)) {
    data.unlockedSkins = [...data.unlockedSkins, id];
    await persistSave(data);
  }
  return data;
}
export async function unlockAchievement(id: string) {
  const data = await loadSave();
  if (!data.achievements.includes(id)) {
    data.achievements = [...data.achievements, id];
    await persistSave(data);
  }
  return data;
}
