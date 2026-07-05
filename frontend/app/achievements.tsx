// Achievements gallery — shows earned + locked achievements with descriptions.

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/src/game/constants";
import { getCachedSave, loadSave } from "@/src/game/save";
import { ACHIEVEMENTS, earnedAchievements } from "@/src/game/achievements";

export default function AchievementsScreen() {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    loadSave().then(() => setTick((n) => n + 1));
  }, []);

  const save = getCachedSave();
  // Merge the persisted set with any dynamic earnings so newly-met
  // conditions surface immediately even if the level result save hasn't
  // fired for this build.
  const earnedSet = new Set([...save.achievements, ...earnedAchievements(save)]);
  const earnedCount = ACHIEVEMENTS.filter((a) => earnedSet.has(a.id)).length;

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
          <Text style={styles.title}>ACHIEVEMENTS</Text>
          <View style={{ width: 88 }} />
        </View>

        <View style={styles.progressBar}>
          <Text style={styles.progressText}>
            {earnedCount} / {ACHIEVEMENTS.length} EARNED
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(earnedCount / ACHIEVEMENTS.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {ACHIEVEMENTS.map((a) => {
            const earned = earnedSet.has(a.id);
            return (
              <View
                key={a.id}
                testID={`ach-${a.id}`}
                style={[styles.card, earned && styles.cardEarned, !earned && styles.cardLocked]}
              >
                <View style={[styles.iconWrap, earned && styles.iconWrapEarned]}>
                  <Text style={[styles.iconText, earned && styles.iconTextEarned]}>{a.icon}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={[styles.cardName, !earned && styles.cardNameLocked]}>
                    {a.name}
                  </Text>
                  <Text style={styles.cardDesc}>{a.description}</Text>
                </View>
                {earned ? (
                  <View style={styles.check}>
                    <Text style={styles.checkText}>{"\u2713"}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1, padding: 24 },
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
    letterSpacing: 4,
  },
  progressBar: {
    marginBottom: 12,
  },
  progressText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "800",
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.cyan,
  },
  list: {
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardEarned: {
    borderColor: COLORS.cyan,
    backgroundColor: "rgba(0, 229, 255, 0.06)",
  },
  cardLocked: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapEarned: {
    backgroundColor: "rgba(0, 229, 255, 0.15)",
  },
  iconText: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: "800",
  },
  iconTextEarned: {
    color: COLORS.cyan,
  },
  info: { flex: 1 },
  cardName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cardNameLocked: {
    color: COLORS.textSecondary,
  },
  cardDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cyan,
  },
  checkText: {
    color: COLORS.bg,
    fontWeight: "900",
    fontSize: 14,
  },
  pressed: { opacity: 0.75 },
});
