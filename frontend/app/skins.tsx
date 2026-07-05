// Skins gallery — pick from unlocked skins, view locked ones with hints.
//
// Selecting a skin persists it into save data; the character sprite reads
// the currently-selected skin id lazily via `getCurrentSkin`.

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/src/game/constants";
import { getCachedSave, loadSave, setSelectedSkin } from "@/src/game/save";
import { SKINS } from "@/src/game/skins";

export default function SkinsScreen() {
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    loadSave().then(() => setTick((n) => n + 1));
  }, []);

  const save = getCachedSave();

  const pick = async (id: string) => {
    if (!save.unlockedSkins.includes(id)) return;
    await setSelectedSkin(id);
    setTick((n) => n + 1);
  };

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
          <Text style={styles.title}>SKINS</Text>
          <View style={{ width: 88 }} />
        </View>

        <ScrollView contentContainerStyle={styles.grid}>
          {SKINS.map((s) => {
            const unlocked = save.unlockedSkins.includes(s.id);
            const selected = save.selectedSkin === s.id;
            return (
              <Pressable
                key={s.id}
                testID={`skin-${s.id}`}
                onPress={() => pick(s.id)}
                disabled={!unlocked}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  !unlocked && styles.cardLocked,
                  pressed && unlocked && styles.pressed,
                ]}
              >
                <View style={[styles.chip, { backgroundColor: s.bodyMain, borderColor: s.visor }]}>
                  <View style={[styles.chipVisor, { backgroundColor: s.visor }]} />
                  <View style={[styles.chipAccent, { backgroundColor: s.accent }]} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, !unlocked && styles.cardNameLocked]}>{s.name}</Text>
                  <Text style={styles.cardUnlock}>
                    {unlocked ? (selected ? "EQUIPPED" : "TAP TO EQUIP") : `\uD83D\uDD12 ${s.unlock}`}
                  </Text>
                </View>
              </Pressable>
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
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    width: "48%",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardSelected: {
    borderColor: COLORS.cyan,
    borderWidth: 2,
    backgroundColor: "rgba(0, 229, 255, 0.08)",
  },
  cardLocked: {
    opacity: 0.55,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  chipVisor: {
    width: 20,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  chipAccent: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cardNameLocked: {
    color: COLORS.textSecondary,
  },
  cardUnlock: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  pressed: { opacity: 0.75 },
});
