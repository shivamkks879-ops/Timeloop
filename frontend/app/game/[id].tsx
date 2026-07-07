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
import { bumpDeathStat, bumpPlaytime, getCachedSave, recordLevelResult } from "@/src/game/save";
import { playCue } from "@/src/game/audio";
import { haptic } from "@/src/game/haptics";
import { spawnBurst } from "@/src/game/particles";

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
  // Screen shake driver: number of ticks of shake remaining + peak intensity.
  const shakeRef = useRef<{ ticks: number; peak: number }>({ ticks: 0, peak: 0 });
  // Level-start timestamp for stats (fastest clear + playtime accumulation).
  const levelStartRef = useRef<number>(Date.now());
  const lastRef = useRef(0);

  // Snapshot of last-tick fields used to detect discrete audio events
  // (jump/land/portal/key/mid-loop death). Kept in a ref to avoid re-renders.
  const prevRef = useRef({
    onGround: true,
    vy: 0,
    teleCd: 0,
    alive: true,
    keys: 0,
  });

  // Init engine when level changes.
  useEffect(() => {
    if (!level) return;
    stateRef.current = initEngine(level);
    setOutcome(null);
    setPaused(false);
    pausedRef.current = false;
    prevRef.current = { onGround: true, vy: 0, teleCd: 0, alive: true, keys: 0 };
    levelStartRef.current = Date.now();
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
          const cur = stateRef.current;

          // ---- Discrete audio events (edge-triggered) ----
          const p = prevRef.current;
          const gDir = cur.player.gravityDir;
          // Jump: was on ground last tick, now airborne moving against gravity.
          if (p.onGround && !cur.player.onGround && cur.player.vy * gDir < 0) {
            playCue("jump");
            haptic("jump");
            const feetY = cur.player.gravityDir === 1
              ? cur.player.y + 28
              : cur.player.y;
            spawnBurst({
              x: cur.player.x + 11,
              y: feetY,
              color: "rgba(0, 229, 255, 0.9)",
              count: 4,
              speed: 2.4,
              life: 320,
              radius: 2,
              gravity: cur.player.gravityDir === 1 ? 0.15 : -0.15,
            });
          }
          // Land: was airborne, now on ground.
          if (!p.onGround && cur.player.onGround) {
            playCue("land");
            haptic("land");
            const fallSpeed = Math.abs(p.vy);
            if (fallSpeed > 1.5) {
              const feetY = cur.player.gravityDir === 1
                ? cur.player.y + 28
                : cur.player.y;
              const dustCount = fallSpeed > 8 ? 7 : 4;
              spawnBurst({
                x: cur.player.x + 11,
                y: feetY,
                color: "rgba(210, 220, 240, 0.85)",
                count: dustCount,
                speed: 2.0,
                life: 420,
                radius: 2,
                gravity: cur.player.gravityDir === 1 ? -0.05 : 0.05,
              });
              if (fallSpeed > 8) {
                shakeRef.current = { ticks: 6, peak: 2.5 };
              }
            }
          }
          // Portal: teleCd goes from 0 → positive means we just teleported.
          if (p.teleCd === 0 && cur.player.teleCd > 0) {
            playCue("portal");
            haptic("portal");
            spawnBurst({
              x: cur.player.x + 11,
              y: cur.player.y + 14,
              color: "rgba(157, 0, 255, 0.95)",
              count: 8,
              speed: 3.4,
              life: 480,
              radius: 3,
              gravity: 0,
            });
          }
          // Key pickup: collectedKeys count grew.
          if (cur.collectedKeys.size > p.keys) {
            playCue("echo_create");
            haptic("key");
            spawnBurst({
              x: cur.player.x + 11,
              y: cur.player.y + 14,
              color: "rgba(0, 255, 136, 0.95)",
              count: 7,
              speed: 2.6,
              life: 520,
              radius: 3,
              gravity: 0,
            });
          }
          // Laser mid-loop death (before overall status changes).
          if (p.alive && !cur.player.alive && cur.status === "playing") {
            playCue("laser");
            haptic("laser");
            spawnBurst({
              x: cur.player.x + 11,
              y: cur.player.y + 14,
              color: "rgba(255, 0, 60, 0.95)",
              count: 12,
              speed: 4.2,
              life: 620,
              radius: 3,
              gravity: 0.3,
            });
            shakeRef.current = { ticks: 14, peak: 6 };
          }
          prevRef.current = {
            onGround: cur.player.onGround,
            vy: cur.player.vy,
            teleCd: cur.player.teleCd,
            alive: cur.player.alive,
            keys: cur.collectedKeys.size,
          };

          if (cur.loop > prevLoop) {
            playCue("rewind");
            playCue("echo_create");
            haptic("rewind");
            spawnBurst({
              x: cur.spawnX + 11,
              y: cur.spawnY + 14,
              color: "rgba(157, 0, 255, 0.9)",
              count: 14,
              speed: 4.5,
              life: 780,
              radius: 3,
              gravity: 0,
            });
            shakeRef.current = { ticks: 20, peak: 8 };
            prevRef.current.onGround = true;
            prevRef.current.alive = true;
            prevRef.current.vy = 0;
            prevRef.current.teleCd = 0;
          }

          // Decay shake counter each tick.
          if (shakeRef.current.ticks > 0) shakeRef.current.ticks -= 1;
        }
        setFrame((n) => (n + 1) % 1_000_000);

        // Handle terminal states
        const s = stateRef.current;
        if (s && s.status === "won" && !outcome) {
          const grade = computeGrade(s.level, s.loop);
          const stars = gradeToStars(grade);
          const clearMs = Date.now() - levelStartRef.current;
          setOutcome({ kind: "won", loops: s.loop, grade, stars });
          recordLevelResult(s.level.id, s.loop, grade, stars, clearMs).catch(() => {});
          bumpPlaytime(clearMs).catch(() => {});
          playCue("win");
          haptic("win");
          // Confetti-ish victory burst at the player's location.
          spawnBurst({
            x: s.player.x + 11,
            y: s.player.y + 14,
            color: "rgba(0, 229, 255, 0.95)",
            count: 16,
            speed: 5,
            life: 900,
            radius: 3,
            gravity: 0.05,
          });
          spawnBurst({
            x: s.player.x + 11,
            y: s.player.y + 14,
            color: "rgba(0, 255, 136, 0.95)",
            count: 10,
            speed: 3.6,
            life: 780,
            radius: 3,
            gravity: 0.05,
          });
        }
        if (s && s.status === "dead" && !outcome) {
          const playedMs = Date.now() - levelStartRef.current;
          setOutcome({ kind: "dead", loops: s.loop });
          playCue("die");
          haptic("death");
          shakeRef.current = { ticks: 24, peak: 10 };
          bumpDeathStat().catch(() => {});
          bumpPlaytime(playedMs).catch(() => {});
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

  // Screen shake offset — derived per-render from the shakeRef counter.
  // Uses a cheap deterministic-ish pseudo-random from the frame counter so
  // the shake pattern is smooth but not obviously periodic.
  let shakeX = 0;
  let shakeY = 0;
  if (shakeRef.current.ticks > 0 && getCachedSave().screenShake) {
    const t = shakeRef.current.ticks;
    const peak = shakeRef.current.peak;
    const mag = (t / 24) * peak;
    const a = t * 1.3;
    shakeX = Math.sin(a) * mag;
    shakeY = Math.cos(a * 1.7) * mag;
  }

  const doRetry = () => {
    if (!stateRef.current) return;
    stateRef.current = resetLevel(stateRef.current);
    setOutcome(null);
    setPaused(false);
    prevRef.current = { onGround: true, vy: 0, teleCd: 0, alive: true, keys: 0 };
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
      {/* Game view extends *behind* the safe area so the canvas fills every
          pixel edge-to-edge on notched / cutout displays. Interactive UI
          (HUD, controls, overlays) still respects the safe insets so they
          never end up under a notch. */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) =>
          setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        {size.w > 0 && s ? (
          <View style={[styles.canvasWrap, { transform: [{ translateX: shakeX }, { translateY: shakeY }] }]}>
            <Suspense fallback={<View style={styles.canvasWrap} />}>
              <GameRenderer state={s} width={size.w} height={size.h} timeLow={timeSec <= 3} />
            </Suspense>
          </View>
        ) : null}
        {/* Interactive layer (HUD + touch controls + hint) is inset by the
            safe area so buttons don't hide under system UI. */}
        <SafeAreaView style={StyleSheet.absoluteFill} edges={["top", "bottom", "left", "right"]} pointerEvents="box-none">

        <HUD
          timeSec={timeSec}
          loop={s?.loop ?? 0}
          maxEchoes={level.maxEchoes}
          onPause={() => { playCue("ui_tap"); setPaused(true); }}
          onRestart={() => { playCue("ui_tap"); doRetry(); }}
          levelName={`${level.id} · ${level.name}`}
        />

        <TouchControls
          onChange={(c) => (controlsRef.current = c)}
          paused={paused || outcome !== null}
          oneThumb={getCachedSave().oneThumb}
          opacity={getCachedSave().controlOpacity}
        />

        <HintOverlay text={level.hint} />
        </SafeAreaView>
      </View>

      <PauseOverlay
        visible={paused && !outcome}
        onResume={() => { playCue("ui_tap"); setPaused(false); }}
        onRestart={() => { playCue("ui_tap"); doRetry(); }}
        onQuit={() => { playCue("ui_tap"); doQuit(); }}
      />
      <OutcomeOverlay
        outcome={outcome}
        parEchoes={level.parEchoes}
        onRetry={() => { playCue("ui_tap"); doRetry(); }}
        onNext={() => { playCue("ui_tap"); doNext(); }}
        onQuit={() => { playCue("ui_tap"); doQuit(); }}
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
  // Staggered star reveal — count-up animation.
  const [starsShown, setStarsShown] = useState(0);
  useEffect(() => {
    setStarsShown(0);
    if (!outcome || outcome.kind !== "won") return;
    const target = outcome.stars ?? 0;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= target; i++) {
      timers.push(
        setTimeout(() => {
          if (!cancelled) setStarsShown(i);
        }, 220 * i + 240),
      );
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [outcome?.kind, outcome?.stars, outcome?.loops]);

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
                  {[0, 1, 2].map((i) => {
                    const lit = i < starsShown;
                    return (
                      <Text
                        key={i}
                        style={[
                          styles.starBig,
                          lit ? styles.starLit : styles.starDim,
                          { transform: [{ scale: lit ? 1.05 : 0.85 }] },
                        ]}
                      >
                        {"\u2605"}
                      </Text>
                    );
                  })}
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
    backgroundColor: "rgba(10, 11, 16, 0.82)",
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 18,
    maxWidth: "78%",
  },
  hintText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.2,
    textAlign: "center",
    lineHeight: 20,
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
