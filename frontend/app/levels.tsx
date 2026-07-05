// Level select grid. Locked levels are dimmed with a lock; unlocked levels
// show star grades and best-run info.

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/src/game/constants";
import { LEVELS } from "@/src/game/levels";
import { getCachedSave, isLevelUnlocked, loadSave } from "@/src/game/save";

export default function LevelSelect() {
  const router = useRouter();
  const [_, setTick] = useState(0);

  useEffect(() => {
    loadSave().then(() => setTick((n) => n + 1));
  }, []);

  const save = getCachedSave();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            testID="btn-back"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backLabel}>{"\u2039"} BACK</Text>
          </Pressable>
          <Text style={styles.title}>WORLD 1 · LEARNING TIME</Text>
          <View style={{ width: 88 }} />
        </View>

        <View style={styles.grid}>
          {LEVELS.map((l) => {
            const unlocked = isLevelUnlocked(save, l.id);
            const entry = save.levels[l.id];
            const stars = entry?.stars ?? 0;
            return (
              <Pressable
                key={l.id}
                testID={`level-node-${l.id}`}
                disabled={!unlocked}
                onPress={() => router.push(`/game/${l.id}` as any)}
                style={({ pressed }) => [
                  styles.card,
                  !unlocked && styles.cardLocked,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.cardId, !unlocked && styles.cardDimText]}>{l.id}</Text>
                <Text style={[styles.cardName, !unlocked && styles.cardDimText]}>
                  {unlocked ? l.name : "LOCKED"}
                </Text>
                <View style={styles.stars}>
                  {[0, 1, 2].map((i) => (
                    <Text
                      key={i}
                      style={[
                        styles.star,
                        i < stars ? styles.starFilled : styles.starEmpty,
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
    marginBottom: 20,
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
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "center",
  },
  card: {
    width: 140,
    height: 130,
    borderRadius: 14,
    borderColor: COLORS.cyan,
    borderWidth: 1.5,
    backgroundColor: "rgba(22, 24, 36, 0.9)",
    padding: 12,
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
    fontSize: 20,
    letterSpacing: 2,
  },
  cardName: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  stars: {
    flexDirection: "row",
    gap: 4,
  },
  star: {
    fontSize: 16,
  },
  starFilled: {
    color: COLORS.green,
    textShadowColor: COLORS.green,
    textShadowRadius: 6,
  },
  starEmpty: {
    color: COLORS.textMuted,
  },
  pressed: { opacity: 0.7 },
});
