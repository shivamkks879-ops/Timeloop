// Skia-drawn robot character with vector "animation frames".
//
// Pose is derived analytically from the current actor state + a monotonic
// animation clock (frame counter), so no sprite sheets are needed. This
// keeps the engine fully deterministic and lets a single component render
// both the live player and every ghost echo.
//
// Poses:
//   - idle           : subtle bob + antenna sway
//   - run            : leg swing + arm counter-swing
//   - jump  (rising) : legs tucked up, arms slightly up
//   - fall  (falling): legs streaming down, arms out
//   - wall_slide     : one arm braced against wall, legs bent
//   - land  (brief)  : shallow squash after a landing (~10 ticks)
//   - victory        : arms up, sparks
//   - dead           : slumped, red

import React from "react";
import {
  Blur,
  Circle,
  Group,
  Line,
  Path,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from "@shopify/react-native-skia";

import { COLORS } from "./constants";
import { PLAYER_H, PLAYER_W } from "./engine";
import { getCurrentSkin } from "./skins";
import type { PlayerState } from "./types";

export type Pose =
  | "idle"
  | "run"
  | "jump"
  | "fall"
  | "wall_slide"
  | "land"
  | "victory"
  | "dead";

export function derivePose(
  actor: PlayerState,
  status: "playing" | "won" | "dead",
  landTick: number,
  frame: number,
): Pose {
  if (!actor.alive) return "dead";
  if (status === "won") return "victory";
  const gDir = actor.gravityDir;
  const rising = actor.vy * gDir < -0.1;
  const falling = actor.vy * gDir > 0.1;
  if (!actor.onGround && actor.wallDir !== 0 && !rising) return "wall_slide";
  if (!actor.onGround && rising) return "jump";
  if (!actor.onGround && falling) return "fall";
  // On-ground poses: recently landed = brief land squash, else run/idle.
  if (landTick >= 0 && frame - landTick < 8) return "land";
  if (Math.abs(actor.vx) > 0.5) return "run";
  return "idle";
}

interface Props {
  actor: PlayerState;
  frame: number;
  pose: Pose;
  echo?: boolean;
  echoAlive?: boolean;
  /** Fraction of loop time remaining (1 → 0). Drives the Time Core pulse
   *  speed: the core beats faster as the loop runs out. Echoes omit it. */
  timeFrac?: number;
}

// Convenient tint palette.
const BODY_LIGHT = "#F0F5FF";
const BODY_DARK = "#4A5468";
const ECHO_BODY = "#9D00FF";
const ECHO_DARK = "#5A0080";
const RED = COLORS.red;

/**
 * Draw the hybrid android ("exo-suit runner") centred on its bounding box
 * (x,y) → (x+w, y+h). When gravity flips (`actor.gravityDir === -1`) we
 * mirror vertically so the character stands on the "ceiling".
 *
 * Design (Option 3 — Hybrid):
 *   • Dark tactical exo-suit body with cyan Tron-style energy seams
 *   • Segmented armor chest plate + shoulder pads
 *   • Two-segment robotic arms with elbow joints
 *   • Wrist-mounted Time Core ring on the facing arm (glowing)
 *   • Hooded helmet with swept-back crest fin (replaces the antenna)
 *   • Armored thruster boots with cyan soles
 *   • Chest Time Core that pulses — faster as the loop timer runs low
 */
export function RobotSprite({ actor, frame, pose, echo, echoAlive, timeFrac }: Props) {
  const w = PLAYER_W;
  const h = PLAYER_H;
  const x = actor.x;
  const y = actor.y;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const flip = actor.gravityDir === -1;
  const face = actor.facing >= 0 ? 1 : -1;

  const skin = echo ? null : getCurrentSkin();
  const bodyMain = echo ? ECHO_BODY : pose === "dead" ? RED : (skin?.bodyMain ?? BODY_LIGHT);
  const bodyShade = echo ? ECHO_DARK : pose === "dead" ? "#8A0020" : (skin?.bodyShade ?? BODY_DARK);
  const visor = echo ? "#E0A0FF" : (skin?.visor ?? COLORS.cyan);
  const opacity = echo ? (echoAlive === false ? 0.28 : 0.55) : pose === "dead" ? 0.55 : 1;

  // ---- Pose-driven joints ----
  const swing = (freq: number, phase = 0) =>
    Math.sin((frame / 60) * freq * 2 * Math.PI + phase);

  let legL = 0, legR = 0;      // rotation offsets (px at foot)
  let armL = 0, armR = 0;
  let squash = 0;              // vertical scale offset for body (-2..+2)
  let bob = 0;                 // vertical head bob (px)
  let antenna = 0;             // antenna sway (px)
  let armLift = 0;             // arms up (px, negative = up)
  let victorySparkle = 0;

  switch (pose) {
    case "idle": {
      bob = Math.sin(frame / 20) * 0.6;
      antenna = Math.sin(frame / 24) * 1.5;
      // subtle idle leg fidget
      legL = Math.sin(frame / 40) * 0.4;
      legR = -legL;
      break;
    }
    case "run": {
      const s = swing(6);       // ~6 Hz stride at 60fps
      legL = s * 4;
      legR = -s * 4;
      armL = -s * 3;
      armR = s * 3;
      bob = Math.abs(s) * 1.2 - 0.6;
      antenna = -s * 2;
      break;
    }
    case "jump": {
      legL = -3; legR = -3;     // tucked
      armLift = -3;
      squash = -1.5;            // stretched
      antenna = -2;
      break;
    }
    case "fall": {
      legL = 4; legR = 4;
      armR = 3; armL = 3;
      squash = 1;
      antenna = 3;
      break;
    }
    case "wall_slide": {
      // Facing away from wall; bent knees; one arm braced against wall.
      legL = 3; legR = 3;
      armR = face > 0 ? -4 : 4;
      armL = face > 0 ? 4 : -4;
      antenna = 4;
      break;
    }
    case "land": {
      squash = 2;               // body compresses briefly
      legL = 1; legR = 1;
      bob = 1;
      break;
    }
    case "victory": {
      armLift = -6 + Math.sin(frame / 8) * 1;
      antenna = Math.sin(frame / 10) * 3;
      bob = Math.sin(frame / 12) * 1.5;
      victorySparkle = 1;
      break;
    }
    case "dead": {
      // Rotate/slump; use squash + wide arms.
      squash = 3;
      armR = 5; armL = -5;
      legL = 3; legR = -3;
      break;
    }
  }

  // Adjust for gravity flip: invert vertical component of all offsets.
  const g = flip ? -1 : 1;

  // ---- Geometry ----
  const bodyW = w - 4;
  const bodyH = h - 12 - squash * g;
  const bodyX = x + 2;
  const bodyY = flip ? y + 8 + squash * g : y + 8 - squash * g;
  const headR = 6;
  const headCx = cx;
  const headCy = flip ? y + h - 4 - bob : y + 4 + bob;
  const footBaseY = flip ? y + 4 : y + h - 4;

  // Path builder for a straight limb between two points, with rounded ends.
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const p = Skia.Path.Make();
    p.moveTo(x1, y1);
    p.lineTo(x2, y2);
    return p;
  };

  // Arms: shoulder anchors near top of body, hands extend downward (or up).
  //
  // SIDE-PROFILE STANCE: in a platformer the character runs in profile, so
  // BOTH shoulders and BOTH hands are biased toward the facing direction.
  // Without this the arms sit symmetrically at the body's left/right edges
  // and the character reads as a front-facing doll rather than a runner
  // leaning into their direction of travel.
  const shoulderY = flip ? bodyY + bodyH - 2 : bodyY + 2;
  const shoulderLx = bodyX + 2 + face * 1.5;
  const shoulderRx = bodyX + bodyW - 2 + face * 1.5;
  const armLen = 8;
  const handLy = shoulderY + (armLen + armLift) * g;
  const handRy = shoulderY + (armLen + armLift) * g;
  // Swing offset from the pose system PLUS a constant forward bias so the
  // hands always sit slightly in front of the chest (runner's ready stance).
  const armFwd = face * 2;
  const armLxOff = armL * face + armFwd;
  const armRxOff = armR * face + armFwd;

  // Legs: hip anchors near bottom of body, feet extend down (or up).
  const hipY = flip ? bodyY + 2 : bodyY + bodyH - 2;
  const hipLx = bodyX + 4;
  const hipRx = bodyX + bodyW - 4;
  const footLxOff = legL * face;
  const footRxOff = legR * face;
  const legLpath = line(hipLx, hipY, hipLx + footLxOff, footBaseY);
  const legRpath = line(hipRx, hipY, hipRx + footRxOff, footBaseY);

  // Hood-crest sway reuses the old antenna sway variable so idle/run
  // animation phases stay in sync with the rest of the pose system.
  // (The swept helmet crest above consumes `antenna`.)

  // Facing indicator: visor eye tilts toward facing direction.
  const eyeOffset = 1.4 * face;

  // Visual scale — makes the robot render ~30% larger than its collision
  // box so it reads well on phone screens without changing physics.
  //
  // Direction: we do NOT use a scaleX flip here. All directional asymmetry
  // (arm swing, eye position, jaw bump, antenna lean, visor sweep) is
  // already multiplied by `face` in the geometry above. Applying an
  // additional scaleX mirror would double-flip and cancel out — the classic
  // "character always faces right" bug this file previously suffered.
  const VISUAL_SCALE = 1.35;

  return (
    <Group
      opacity={opacity}
      transform={[
        { translateX: cx },
        { translateY: cy },
        { scaleX: VISUAL_SCALE },
        { scaleY: VISUAL_SCALE },
        { translateX: -cx },
        { translateY: -cy },
      ]}
    >
      {/* Ambient glow behind body — skipped on echoes to keep blur passes
          low. Blur is the single most expensive Skia op on mid-range
          Android, so we only render one per character (player only). */}
      {!echo ? (
        <RoundedRect
          x={x - 3}
          y={y - 3}
          width={w + 6}
          height={h + 6}
          r={10}
          color={visor}
          opacity={0.22}
        >
          <Blur blur={3} />
        </RoundedRect>
      ) : null}

      {/* ── LEGS: two-segment armored limbs + thruster boots ─────────
          The joint paths (hip→foot) come from the pose system; we draw
          them as thicker armored limbs and cap each with a boot. */}
      <Path path={legLpath} color={bodyShade} style="stroke" strokeWidth={3.4} strokeCap="round" />
      <Path path={legRpath} color={bodyShade} style="stroke" strokeWidth={3.4} strokeCap="round" />
      {/* Knee guards — small plates at the midpoint of each leg */}
      <Circle cx={(hipLx + hipLx + footLxOff) / 2} cy={(hipY + footBaseY) / 2} r={1.7} color={bodyMain} />
      <Circle cx={(hipRx + hipRx + footRxOff) / 2} cy={(hipY + footBaseY) / 2} r={1.7} color={bodyMain} />
      {/* Thruster boots — rounded armor cap + cyan sole strip */}
      <RoundedRect x={hipLx + footLxOff - 3.2} y={footBaseY - 2 * g - (g > 0 ? 0 : 4)} width={6.4} height={4} r={1.6} color={bodyMain} />
      <RoundedRect x={hipRx + footRxOff - 3.2} y={footBaseY - 2 * g - (g > 0 ? 0 : 4)} width={6.4} height={4} r={1.6} color={bodyMain} />
      <Rect x={hipLx + footLxOff - 3.2} y={flip ? footBaseY : footBaseY - 1} width={6.4} height={1.4} color={visor} opacity={0.9} />
      <Rect x={hipRx + footRxOff - 3.2} y={flip ? footBaseY : footBaseY - 1} width={6.4} height={1.4} color={visor} opacity={0.9} />

      {/* ── BODY: dark exo-suit + chest armor plate + energy seams ── */}
      <RoundedRect x={bodyX} y={bodyY} width={bodyW} height={bodyH} r={5} color={bodyShade} />
      {/* Chest armor plate (lighter, sits over the suit) */}
      <RoundedRect
        x={bodyX + 2}
        y={bodyY + 1.5}
        width={bodyW - 4}
        height={bodyH * 0.62}
        r={4}
        color={bodyMain}
      />
      {/* Tron-style energy seams — vertical spine + waist band */}
      <Rect x={cx - 0.5} y={bodyY + 2} width={1} height={bodyH - 4} color={visor} opacity={0.75} />
      <Rect x={bodyX + 2} y={bodyY + bodyH * 0.62} width={bodyW - 4} height={1} color={visor} opacity={0.55} />

      {/* ── TIME CORE — pulsing chest orb. Beats faster as the loop
          timer drains (timeFrac 1 → 0): the character literally shows
          the countdown on its chest. */}
      {(() => {
        const pulseSpeed = 0.12 + (1 - (timeFrac ?? 1)) * 0.4;
        const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame * pulseSpeed));
        return (
          <Group>
            <Circle cx={cx} cy={bodyY + bodyH * 0.38} r={3.4} color={visor} opacity={0.35 * pulse}>
              {!echo ? <Blur blur={3} /> : null}
            </Circle>
            <Circle cx={cx} cy={bodyY + bodyH * 0.38} r={2.2} color={visor} opacity={pulse} />
            <Circle cx={cx} cy={bodyY + bodyH * 0.38} r={0.9} color="#FFFFFF" opacity={pulse} />
          </Group>
        );
      })()}

      {/* Shoulder pads */}
      <Circle cx={shoulderLx} cy={shoulderY} r={2.6} color={bodyMain} />
      <Circle cx={shoulderRx} cy={shoulderY} r={2.6} color={bodyMain} />

      {/* ── ARMS: two-segment robotic limbs with elbow joints ────────
          We split each arm path at its midpoint to fake an elbow, so
          the limb reads as articulated rather than a rubber noodle. */}
      {(() => {
        const elbLx = shoulderLx + (armLxOff - 1) * 0.5;
        const elbLy = shoulderY + ((armLen + armLift) * g) * 0.5;
        const elbRx = shoulderRx + (armRxOff + 1) * 0.5;
        const elbRy = shoulderY + ((armLen + armLift) * g) * 0.5;
        const handLx = shoulderLx - 1 + armLxOff;
        const handRx = shoulderRx + 1 + armRxOff;
        return (
          <Group>
            {/* Left arm: upper + forearm */}
            <Path path={line(shoulderLx, shoulderY, elbLx, elbLy)} color={bodyMain} style="stroke" strokeWidth={2.8} strokeCap="round" />
            <Path path={line(elbLx, elbLy, handLx, handLy)} color={bodyShade} style="stroke" strokeWidth={2.2} strokeCap="round" />
            <Circle cx={elbLx} cy={elbLy} r={1.2} color={bodyShade} />
            {/* Right arm: upper + forearm */}
            <Path path={line(shoulderRx, shoulderY, elbRx, elbRy)} color={bodyMain} style="stroke" strokeWidth={2.8} strokeCap="round" />
            <Path path={line(elbRx, elbRy, handRx, handRy)} color={bodyShade} style="stroke" strokeWidth={2.2} strokeCap="round" />
            <Circle cx={elbRx} cy={elbRy} r={1.2} color={bodyShade} />
            {/* Wrist Time Core ring on the FACING arm — the gadget that
                powers the loop. Small glowing ring + core dot. */}
            {(() => {
              const hx = face > 0 ? handRx : handLx;
              const hy = face > 0 ? handRy : handLy;
              return (
                <Group>
                  <Circle cx={hx} cy={hy} r={2.2} color={visor} style="stroke" strokeWidth={1.1} opacity={0.95} />
                  <Circle cx={hx} cy={hy} r={0.9} color="#FFFFFF" opacity={0.9} />
                </Group>
              );
            })()}
          </Group>
        );
      })()}

      {/* ── HELMET: hooded dome + swept crest + visor band ─────────── */}
      <Circle cx={headCx} cy={headCy} r={headR} color={bodyMain} />
      {/* Hood crest — a swept fin leaning AWAY from the facing direction
          (aerodynamic "running hood" silhouette). Replaces the old antenna. */}
      {(() => {
        const crestBaseY = flip ? headCy + headR * 0.4 : headCy - headR * 0.9;
        const crestTipX = headCx - face * (headR + 4 + antenna * 0.5);
        const crestTipY = flip ? crestBaseY + 5 : crestBaseY - 1.5;
        const p = Skia.Path.Make();
        p.moveTo(headCx, crestBaseY);
        p.quadTo(headCx - face * (headR * 0.9), crestBaseY - 2 * g, crestTipX, crestTipY);
        return (
          <>
            <Path path={p} color={bodyShade} style="stroke" strokeWidth={2.6} strokeCap="round" />
            <Circle cx={crestTipX} cy={crestTipY} r={1.2} color={visor}>
              {!echo ? <Blur blur={1.2} /> : null}
            </Circle>
          </>
        );
      })()}

      {/* Visor band — a horizontal armored slit across the face */}
      <RoundedRect
        x={headCx - headR * 0.85}
        y={headCy - 2.2}
        width={headR * 1.7}
        height={4.4}
        r={2.2}
        color={bodyShade}
      />
      {/* Bright visor eye — pushed hard to the front-of-face side.
          The rect is anchored at its LEFT edge; when facing left we shift
          the anchor back by the width so the eye appears on the LEFT side
          of the head instead of extending past it. */}
      <RoundedRect
        x={face >= 0 ? headCx + 0.4 + eyeOffset * 2 : headCx - 0.4 + eyeOffset * 2 - 5.5}
        y={headCy - 1.3}
        width={5.5}
        height={2.6}
        r={1.2}
        color="#FFFFFF"
      />
      <RoundedRect
        x={face >= 0 ? headCx + 0.6 + eyeOffset * 2 : headCx - 0.6 + eyeOffset * 2 - 5.2}
        y={headCy - 1.4}
        width={5.2}
        height={2.8}
        r={1.2}
        color={visor}
        opacity={0.9}
      />
      {/* Jaw bump — a small chin nudge on the facing side. */}
      <Circle cx={headCx + headR * 0.55 * face} cy={headCy + headR * 0.35} r={1.4} color={bodyShade} opacity={0.85} />

      {/* ── RUN TRAIL — faint cyan streaks behind the runner. Drawn in
          the character so it inherits the same mirroring/flip logic.
          Three fading horizontal streaks trail opposite the facing dir. */}
      {pose === "run" ? (
        <Group>
          {[0, 1, 2].map((i) => {
            const dist = 6 + i * 6;
            const ty = cy - 4 + i * 4;
            return (
              <Rect
                key={i}
                x={face > 0 ? cx - dist - 8 : cx + dist}
                y={ty}
                width={8}
                height={1.4}
                color={visor}
                opacity={0.28 - i * 0.08}
              />
            );
          })}
        </Group>
      ) : null}

      {/* Thruster when jumping */}
      {pose === "jump" ? (
        <Group>
          <Path
            path={line(cx - 3, footBaseY, cx - 3, footBaseY + 5 * g)}
            color={COLORS.cyan}
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
          />
          <Path
            path={line(cx + 3, footBaseY, cx + 3, footBaseY + 5 * g)}
            color={COLORS.cyan}
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
          />
          <Circle cx={cx} cy={footBaseY + 6 * g} r={2.2} color={COLORS.cyan} opacity={0.7}>
            <Blur blur={4} />
          </Circle>
        </Group>
      ) : null}

      {/* Victory sparkles */}
      {victorySparkle ? (
        <Group>
          {[0, 1, 2, 3].map((i) => {
            const angle = (frame / 25 + i * (Math.PI / 2)) % (Math.PI * 2);
            const r = 14;
            const sx = cx + Math.cos(angle) * r;
            const sy = cy + Math.sin(angle) * r * 0.6;
            return (
              <Circle key={i} cx={sx} cy={sy} r={1.6} color={COLORS.green}>
                <Blur blur={2} />
              </Circle>
            );
          })}
        </Group>
      ) : null}

      {/* Wall slide contact sparks */}
      {pose === "wall_slide" ? (
        <Group>
          {[0, 1].map((i) => {
            const sx = face > 0 ? x + w + 1 : x - 1;
            const sy = y + 8 + i * 8 + Math.sin(frame / 6 + i) * 2;
            return (
              <Circle key={i} cx={sx} cy={sy} r={1.4} color={COLORS.cyan} opacity={0.7}>
                <Blur blur={2} />
              </Circle>
            );
          })}
        </Group>
      ) : null}

      {/* Dead X eye */}
      {pose === "dead" ? (
        <Group>
          <Path
            path={line(headCx - 2, headCy - 2, headCx + 2, headCy + 2)}
            color={RED}
            style="stroke"
            strokeWidth={1.5}
            strokeCap="round"
          />
          <Path
            path={line(headCx + 2, headCy - 2, headCx - 2, headCy + 2)}
            color={RED}
            style="stroke"
            strokeWidth={1.5}
            strokeCap="round"
          />
        </Group>
      ) : null}
    </Group>
  );
}

// Silence unused import warnings.
void Line;
void vec;
