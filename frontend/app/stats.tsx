// Lifetime statistics screen — shows completion + performance metrics
// pulled from the persistent save.

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/src/game/constants";
import { LEVELS } from "@/src/game/levels";
import { getCachedSave, loadSave } from "@/src/game/save";
import { SKINS } from "@/src/game/skins";
import { ACHIEVEMENTS, earnedAchievements } from "@/src/game/achievements";

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export default function StatsScreen() {
  const router = useRouter();
  const [, setTick] = useState(0);
  useEffect(() => {
    loadSave().then(() => setTick((n) => n + 1));
  }, []);
  const save = getCachedSave();
  const stats = save.stats;

  // Derived — count S/A/B/C grades from the level table.
  let sCount = 0, aCount = 0, bCount = 0, cCount = 0;
  for (const l of Object.values(save.levels)) {
    if (l.grade === "S") sCount++;
    else if (l.grade === "A") aCount++;
    else if (l.grade === "B") bCount++;
    else if (l.grade === "C") cCount++;
  }
  const totalCompleted = Object.values(save.levels).filter((l) => l.completed).length;
  const completionPct = (totalCompleted / LEVELS.length) * 100;
  const earned = earnedAchievements(save);
  const skinsUnlocked = save.unlockedSkins.length;

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
          <Text style={styles.title}>STATISTICS</Text>
          <View style={{ width: 88 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Hero: overall completion */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>COMPLETION</Text>
            <Text style={styles.heroValue}>{Math.round(completionPct)}%</Text>
            <Text style={styles.heroSub}>{totalCompleted} of {LEVELS.length} levels cleared</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
            </View>
          </View>

          {/* Grade summary */}
          <SectionHeader label="GRADES" />
          <View style={styles.gradeRow}>
            <GradeCell letter="S" count={sCount} color={COLORS.cyan} />
            <GradeCell letter="A" count={aCount} color="#00FF88" />
            <GradeCell letter="B" count={bCount} color="#FFC300" />
            <GradeCell letter="C" count={cCount} color="#FF7A00" />
          </View>

          {/* Lifetime numbers */}
          <SectionHeader label="LIFETIME" />
          <View style={styles.card}>
            <StatRow label="Total play time" value={fmtMs(stats.totalPlaytimeMs)} />
            <StatRow label="Total deaths" value={String(stats.totalDeaths)} />
            <StatRow label="Total echoes used" value={String(stats.totalEchoes)} />
            <StatRow
              label="Fastest clear"
              value={stats.fastestClearMs !== null ? fmtMs(stats.fastestClearMs) : "—"}
            />
          </View>

          {/* Meta progress */}
          <SectionHeader label="COLLECTION" />
          <View style={styles.card}>
            <StatRow label="Skins unlocked" value={`${skinsUnlocked} / ${SKINS.length}`} />
            <StatRow label="Achievements" value={`${earned.length} / ${ACHIEVEMENTS.length}`} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function GradeCell({ letter, count, color }: { letter: string; count: number; color: string }) {
  return (
    <View style={[styles.gradeCell, { borderColor: color }]}>
      <Text style={[styles.gradeLetter, { color }]}>{letter}</Text>
      <Text style={styles.gradeCount}>{count}</Text>
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
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 6,
  },
  sectionHeader: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 4,
  },
  heroCard: {
    backgroundColor: "rgba(0, 229, 255, 0.06)",
    borderColor: COLORS.cyan,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  heroLabel: {
    color: COLORS.cyan,
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroValue: {
    color: COLORS.white,
    fontSize: 52,
    fontWeight: "900",
    textShadowColor: COLORS.cyan,
    textShadowRadius: 14,
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 10,
  },
  progressTrack: {
    height: 8,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.cyan,
  },
  gradeRow: {
    flexDirection: "row",
    gap: 8,
  },
  gradeCell: {
    flex: 1,
    backgroundColor: COLORS.panel,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  gradeLetter: {
    fontSize: 30,
    fontWeight: "900",
    textShadowRadius: 8,
  },
  gradeCount: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomColor: "rgba(255,255,255,0.05)",
    borderBottomWidth: 1,
  },
  statLabel: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  statValue: {
    color: COLORS.cyan,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  pressed: { opacity: 0.75 },
});
