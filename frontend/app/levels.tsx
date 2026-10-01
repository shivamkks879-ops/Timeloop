// Level select — grouped by world with headers, scrollable.
// Locked levels are dimmed with a lock; unlocked levels show star grades.

import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playCue } from "@/src/game/audio";
import { COLORS } from "@/src/game/constants";
import { difficultyLabel, difficultyTier, maxStarsForLevel } from "@/src/game/engine";
import { LEVELS } from "@/src/game/levels";
import { getCachedSave, isLevelUnlocked, loadSave } from "@/src/game/save";
import type { LevelDef } from "@/src/game/types";
import { MenuBanner } from "@/src/ads/MenuBanner";

const WORLD_NAMES: Record<number, string> = {
  1: "LEARNING TIME",
  2: "LASERS",
  3: "MOVING PLATFORMS",
  4: "GRAVITY FLIP",
  5: "TELEPORT PORTALS",
  6: "SECURITY FACTORY",
  7: "TIME COLLAPSE",
  8: "FINAL ESCAPE",
};

export default function LevelSelect() {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    loadSave().then(() => setTick((n) => n + 1));
  }, []);

  const save = getCachedSave();

  const worlds = useMemo(() => {
    const groups = new Map<number, LevelDef[]>();
    for (const l of LEVELS) {
      const list = groups.get(l.world) ?? [];
      list.push(l);
      groups.set(l.world, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            testID="btn-back"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => { playCue("ui_tap"); router.back(); }}
          >
            <Text style={styles.backLabel}>{"\u2039"} BACK</Text>
          </Pressable>
          <Text style={styles.title}>LEVELS</Text>
          <View style={{ width: 88 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {worlds.map(([worldNum, levels]) => (
            <View key={worldNum} style={styles.worldBlock}>
              <View style={styles.worldHeader}>
                <Text style={styles.worldNum}>WORLD {worldNum}</Text>
                <View style={styles.worldDivider} />
                <Text style={styles.worldName}>
                  {WORLD_NAMES[worldNum] ?? `WORLD ${worldNum}`}
                </Text>
              </View>
              <View style={styles.grid}>
                {levels.map((l) => {
                  const unlocked = isLevelUnlocked(save, l.id);
                  const entry = save.levels[l.id];
                  const stars = entry?.stars ?? 0;
                  // Difficulty-aware star rendering — tier-3 (boss) levels
                  // can earn up to 5 stars, tier-2 up to 4, tier-1 up to 3.
                  // Players SEE how much is at stake before they tap in.
                  const maxStars = maxStarsForLevel(l);
                  const tier = difficultyTier(l);
                  const diffColor =
                    tier === 3 ? COLORS.purple : tier === 2 ? COLORS.cyan : COLORS.textMuted;
                  return (
                    <Pressable
                      key={l.id}
                      testID={`level-node-${l.id}`}
                      disabled={!unlocked}
                      onPress={() => { playCue("ui_tap"); router.push(`/game/${l.id}` as any); }}
                      style={({ pressed }) => [
                        styles.card,
                        !unlocked && styles.cardLocked,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.cardTopRow}>
                        <Text style={[styles.cardId, !unlocked && styles.cardDimText]}>
                          {l.id}
                        </Text>
                        {unlocked ? (
                          <View style={[styles.diffBadge, { borderColor: diffColor }]}>
                            <Text style={[styles.diffBadgeTxt, { color: diffColor }]}>
                              {difficultyLabel(l).toUpperCase()}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.cardName, !unlocked && styles.cardDimText]}>
                        {unlocked ? l.name : "LOCKED"}
                      </Text>
                      <View style={styles.stars}>
                        {Array.from({ length: maxStars }, (_, i) => (
                          <Text
                            key={i}
                            style={[
                              styles.star,
                              i < stars ? styles.starFilled : styles.starEmpty,
                              // Shrink star size a bit when there are 5 so
                              // they still fit on a small level card.
                              maxStars >= 5 ? styles.starSmall : null,
                            ]}
                          >
                            {"\u2605"}
                          </Text>
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
        <MenuBanner />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1, padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    backgroundColor: "rgba(22, 24, 36, 0.85)",
  },
  backLabel: {
    color: COLORS.cyan,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 6,
  },
  scrollContent: { paddingBottom: 24 },
  worldBlock: { marginBottom: 22 },
  worldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  worldNum: {
    color: COLORS.cyan,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
  },
  worldDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0, 229, 255, 0.25)",
  },
  worldName: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-start",
  },
  card: {
    width: 128,
    height: 116,
    borderRadius: 12,
    borderColor: COLORS.cyan,
    borderWidth: 1.5,
    backgroundColor: "rgba(22, 24, 36, 0.9)",
    padding: 10,
    justifyContent: "space-between",
  },
  cardLocked: {
    borderColor: COLORS.textMuted,
    backgroundColor: "rgba(22, 24, 36, 0.5)",
  },
  cardDimText: {
    color: COLORS.textMuted,
  },
  cardId: {
    color: COLORS.cyan,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 2,
  },
  cardName: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  stars: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
  },
  star: {
    fontSize: 14,
  },
  starSmall: {
    fontSize: 11,
  },
  starFilled: {
    color: COLORS.green,
    textShadowColor: COLORS.green,
    textShadowRadius: 6,
  },
  starEmpty: {
    color: COLORS.textMuted,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 7,
    borderWidth: 1,
  },
  diffBadgeTxt: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  pressed: { opacity: 0.7 },
});
