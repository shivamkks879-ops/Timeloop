// Gameplay screen: mounts the engine, drives a fixed-timestep loop with
// requestAnimationFrame, and composes renderer + HUD + touch controls.

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, SIM } from "@/src/game/constants";
import { ControlState, TouchControls } from "@/src/game/controls";
import {
  computeGrade,
  encodeInput,
  gradeToStars,
  initEngine,
  resetLevel,
  step,
  timeRemaining,
  type EngineState,
} from "@/src/game/engine";
import { HUD } from "@/src/game/hud";
import { getLevel, nextLevelId } from "@/src/game/levels";
import { recordLevelResult } from "@/src/game/save";
import { playCue } from "@/src/game/audio";

// Lazy-load the Skia renderer so its top-level Skia code doesn't run until
// CanvasKit is ready (see _layout.tsx LoadSkiaWeb).
const GameRenderer = React.lazy(() =>
  import("@/src/game/renderer").then((m) => ({ default: m.GameRenderer }))
);

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const levelId = String(params.id ?? "1-1");
  const level = getLevel(levelId);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<null | { kind: "won" | "dead"; loops: number; grade?: "S" | "A" | "B" | "C"; stars?: number }>(null);
  const [_frame, setFrame] = useState(0);

  // Engine + controls in refs so we can mutate at 60Hz without re-render cost.
  const stateRef = useRef<EngineState | null>(null);
  const controlsRef = useRef<ControlState>({ left: false, right: false, jump: false });
  const pausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  // Init engine when level changes.
  useEffect(() => {
    if (!level) return;
    stateRef.current = initEngine(level);
    setOutcome(null);
    setPaused(false);
    pausedRef.current = false;
    setFrame((n) => n + 1);
  }, [level?.id]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Fixed-timestep loop
  useEffect(() => {
    if (!level) return;
    const stepMs = 1000 / SIM.TPS;

    const loop = (now: number) => {
      if (lastRef.current === 0) lastRef.current = now;
      const dt = Math.min(100, now - lastRef.current);
      lastRef.current = now;
      if (!pausedRef.current && stateRef.current) {
        accRef.current += dt;
        while (accRef.current >= stepMs) {
          accRef.current -= stepMs;
          const s = stateRef.current;
          if (s.status !== "playing") break;
          const prevLoop = s.loop;
          const input = encodeInput(
            controlsRef.current.left,
            controlsRef.current.right,
            controlsRef.current.jump
          );
          stateRef.current = step(s, input);
          if (stateRef.current.loop > prevLoop) {
            playCue("rewind");
            playCue("echo_create");
          }
        }
        setFrame((n) => (n + 1) % 1_000_000);

        // Handle terminal states
        const s = stateRef.current;
        if (s && s.status === "won" && !outcome) {
          const grade = computeGrade(s.level, s.loop);
          const stars = gradeToStars(grade);
          setOutcome({ kind: "won", loops: s.loop, grade, stars });
          recordLevelResult(s.level.id, s.loop, grade, stars).catch(() => {});
          playCue("win");
        }
        if (s && s.status === "dead" && !outcome) {
          setOutcome({ kind: "dead", loops: s.loop });
          playCue("die");
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = 0;
      accRef.current = 0;
    };
  }, [level?.id, outcome]);

  if (!level) {
    return (
      <View style={styles.root}>
        <Text style={styles.errText}>Unknown level: {levelId}</Text>
      </View>
    );
  }

  const s = stateRef.current;
  const timeSec = s ? timeRemaining(s) : 10;

  const doRetry = () => {
    if (!stateRef.current) return;
    stateRef.current = resetLevel(stateRef.current);
    setOutcome(null);
    setPaused(false);
    setFrame((n) => n + 1);
  };

  const doQuit = () => {
    router.replace("/levels" as any);
  };

  const doNext = () => {
    const next = nextLevelId(levelId);
    if (next) router.replace(`/game/${next}` as any);
    else router.replace("/levels" as any);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView
        style={styles.safe}
        edges={["top", "bottom", "left", "right"]}
        onLayout={(e) =>
          setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        {size.w > 0 && s ? (
          <View style={styles.canvasWrap}>
            <Suspense fallback={<View style={styles.canvasWrap} />}>
              <GameRenderer state={s} width={size.w} height={size.h} timeLow={timeSec <= 3} />
            </Suspense>
          </View>
        ) : null}

        <HUD
          timeSec={timeSec}
          loop={s?.loop ?? 0}
          maxEchoes={level.maxEchoes}
          onPause={() => setPaused(true)}
          onRestart={doRetry}
          levelName={`${level.id} · ${level.name}`}
        />

        <TouchControls
          onChange={(c) => (controlsRef.current = c)}
          paused={paused || outcome !== null}
        />

        <HintOverlay text={level.hint} />
      </SafeAreaView>

      <PauseOverlay
        visible={paused && !outcome}
        onResume={() => setPaused(false)}
        onRestart={doRetry}
        onQuit={doQuit}
      />
      <OutcomeOverlay
        outcome={outcome}
        parEchoes={level.parEchoes}
        onRetry={doRetry}
        onNext={doNext}
        onQuit={doQuit}
      />
    </View>
  );
}

function HintOverlay({ text }: { text: string }) {
  return (
    <View pointerEvents="none" style={styles.hintWrap}>
      <View style={styles.hintPill}>
        <Text style={styles.hintText}>{text}</Text>
      </View>
    </View>
  );
}

function PauseOverlay({
  visible,
  onResume,
  onRestart,
  onQuit,
}: {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onResume}>
      <View style={styles.overlay}>
        <View style={styles.pauseCard}>
          <Text style={styles.overlayTitle}>PAUSED</Text>
          <View style={styles.overlayActions}>
            <Pressable testID="btn-resume" onPress={onResume} style={({ pressed }) => [styles.oBtn, styles.oPrimary, pressed && styles.pressed]}>
              <Text style={styles.oLabel}>RESUME</Text>
            </Pressable>
            <Pressable testID="btn-retry" onPress={onRestart} style={({ pressed }) => [styles.oBtn, pressed && styles.pressed]}>
              <Text style={styles.oLabel}>RETRY</Text>
            </Pressable>
            <Pressable testID="btn-quit" onPress={onQuit} style={({ pressed }) => [styles.oBtn, pressed && styles.pressed]}>
              <Text style={styles.oLabel}>QUIT</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OutcomeOverlay({
  outcome,
  parEchoes,
  onRetry,
  onNext,
  onQuit,
}: {
  outcome: { kind: "won" | "dead"; loops: number; grade?: "S" | "A" | "B" | "C"; stars?: number } | null;
  parEchoes: number;
  onRetry: () => void;
  onNext: () => void;
  onQuit: () => void;
}) {
  if (!outcome) return null;
  const won = outcome.kind === "won";
  return (
    <Modal transparent visible={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.pauseCard, won ? styles.wonCard : styles.deadCard]}>
          <Text style={[styles.overlayTitle, won ? styles.titleWon : styles.titleDead]}>
            {won ? "ESCAPED" : "TIME COLLAPSED"}
          </Text>
          {won ? (
            <>
              <View style={styles.gradeRow}>
                <Text style={styles.gradeLetter}>{outcome.grade}</Text>
                <View style={styles.starsBig}>
                  {[0, 1, 2].map((i) => (
                    <Text
                      key={i}
                      style={[styles.starBig, i < (outcome.stars ?? 0) ? styles.starLit : styles.starDim]}
                    >
                      {"\u2605"}
                    </Text>
                  ))}
                </View>
              </View>
              <Text style={styles.metaLine}>Echoes used: {outcome.loops} · Par: {parEchoes}</Text>
            </>
          ) : (
            <Text style={styles.metaLine}>The loop closed without escape.</Text>
          )}
          <View style={styles.overlayActions}>
            {won ? (
              <Pressable testID="btn-next" onPress={onNext} style={({ pressed }) => [styles.oBtn, styles.oPrimary, pressed && styles.pressed]}>
                <Text style={styles.oLabel}>NEXT</Text>
              </Pressable>
            ) : null}
            <Pressable testID="btn-retry-outcome" onPress={onRetry} style={({ pressed }) => [styles.oBtn, pressed && styles.pressed]}>
              <Text style={styles.oLabel}>RETRY</Text>
            </Pressable>
            <Pressable testID="btn-quit-outcome" onPress={onQuit} style={({ pressed }) => [styles.oBtn, pressed && styles.pressed]}>
              <Text style={styles.oLabel}>LEVELS</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1 },
  canvasWrap: { ...StyleSheet.absoluteFillObject },
  hintWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 128,
    alignItems: "center",
  },
  hintPill: {
    backgroundColor: "rgba(10, 11, 16, 0.7)",
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    maxWidth: "70%",
  },
  hintText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  errText: { color: COLORS.red, padding: 20 },
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  pauseCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderGlow,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 28,
    minWidth: 360,
    alignItems: "center",
  },
  wonCard: { borderColor: COLORS.green },
  deadCard: { borderColor: COLORS.red },
  overlayTitle: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 6,
    marginBottom: 12,
  },
  titleWon: {
    color: COLORS.green,
    textShadowColor: COLORS.green,
    textShadowRadius: 10,
  },
  titleDead: {
    color: COLORS.red,
    textShadowColor: COLORS.red,
    textShadowRadius: 10,
  },
  gradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginBottom: 12,
  },
  gradeLetter: {
    color: COLORS.cyan,
    fontSize: 72,
    fontWeight: "900",
    textShadowColor: COLORS.cyan,
    textShadowRadius: 14,
  },
  starsBig: { flexDirection: "row", gap: 8 },
  starBig: { fontSize: 34, fontWeight: "900" },
  starLit: {
    color: COLORS.green,
    textShadowColor: COLORS.green,
    textShadowRadius: 10,
  },
  starDim: { color: COLORS.textMuted },
  metaLine: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 18,
    letterSpacing: 1,
  },
  overlayActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  oBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    backgroundColor: "rgba(22, 24, 36, 0.8)",
  },
  oPrimary: {
    backgroundColor: "rgba(0, 229, 255, 0.18)",
    borderColor: COLORS.cyan,
  },
  oLabel: {
    color: COLORS.white,
    fontWeight: "900",
    letterSpacing: 3,
  },
  pressed: { opacity: 0.7 },
});
