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
}

// Convenient tint palette.
const BODY_LIGHT = "#F0F5FF";
const BODY_DARK = "#4A5468";
const ECHO_BODY = "#9D00FF";
const ECHO_DARK = "#5A0080";
const RED = COLORS.red;

/**
 * Draw the robot centred on its bounding box (x,y) → (x+w, y+h).
 * When gravity flips (`actor.gravityDir === -1`) we mirror vertically so the
 * character stands on the "ceiling".
 */
export function RobotSprite({ actor, frame, pose, echo, echoAlive }: Props) {
  const w = PLAYER_W;
  const h = PLAYER_H;
  const x = actor.x;
  const y = actor.y;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const flip = actor.gravityDir === -1;
  const face = actor.facing >= 0 ? 1 : -1;

  const bodyMain = echo ? ECHO_BODY : pose === "dead" ? RED : BODY_LIGHT;
  const bodyShade = echo ? ECHO_DARK : pose === "dead" ? "#8A0020" : BODY_DARK;
  const visor = echo ? "#E0A0FF" : COLORS.cyan;
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
  const shoulderY = flip ? bodyY + bodyH - 2 : bodyY + 2;
  const shoulderLx = bodyX + 2;
  const shoulderRx = bodyX + bodyW - 2;
  const armLen = 8;
  const handLy = shoulderY + (armLen + armLift) * g;
  const handRy = shoulderY + (armLen + armLift) * g;
  const armLxOff = armL * face;
  const armRxOff = armR * face;
  const armLpath = line(shoulderLx, shoulderY, shoulderLx - 1 + armLxOff, handLy);
  const armRpath = line(shoulderRx, shoulderY, shoulderRx + 1 + armRxOff, handRy);

  // Legs: hip anchors near bottom of body, feet extend down (or up).
  const hipY = flip ? bodyY + 2 : bodyY + bodyH - 2;
  const hipLx = bodyX + 4;
  const hipRx = bodyX + bodyW - 4;
  const footLxOff = legL * face;
  const footRxOff = legR * face;
  const legLpath = line(hipLx, hipY, hipLx + footLxOff, footBaseY);
  const legRpath = line(hipRx, hipY, hipRx + footRxOff, footBaseY);

  // Antenna tip (short line rising from head)
  const antennaBaseY = flip ? headCy + headR : headCy - headR;
  const antennaTipY = flip ? antennaBaseY + 5 : antennaBaseY - 5;
  const antennaTipX = headCx + antenna * face;
  const antennaPath = line(headCx, antennaBaseY, antennaTipX, antennaTipY);

  // Facing indicator: visor eye tilts toward facing direction.
  const eyeOffset = 1.4 * face;

  return (
    <Group opacity={opacity}>
      {/* Ambient glow behind body */}
      <RoundedRect
        x={x - 3}
        y={y - 3}
        width={w + 6}
        height={h + 6}
        r={10}
        color={visor}
        opacity={0.22}
      >
        <Blur blur={6} />
      </RoundedRect>

      {/* Legs (draw before body so they sit behind) */}
      <Path path={legLpath} color={bodyShade} style="stroke" strokeWidth={3} strokeCap="round" />
      <Path path={legRpath} color={bodyShade} style="stroke" strokeWidth={3} strokeCap="round" />

      {/* Body — chrome plate with a darker underside strip */}
      <RoundedRect x={bodyX} y={bodyY} width={bodyW} height={bodyH} r={5} color={bodyMain} />
      <RoundedRect
        x={bodyX + 1}
        y={bodyY + 1}
        width={bodyW - 2}
        height={bodyH - 2}
        r={4}
        color={visor}
        style="stroke"
        strokeWidth={0.8}
        opacity={0.55}
      />
      {/* Chest bolt */}
      <Circle cx={cx} cy={bodyY + bodyH / 2} r={1.6} color={visor}>
        <Blur blur={1.2} />
      </Circle>
      {/* Underside shade */}
      <Rect
        x={bodyX + 2}
        y={flip ? bodyY + 1 : bodyY + bodyH - 3}
        width={bodyW - 4}
        height={2}
        color={bodyShade}
        opacity={0.6}
      />

      {/* Arms (drawn after body, in front) */}
      <Path path={armLpath} color={bodyShade} style="stroke" strokeWidth={2.6} strokeCap="round" />
      <Path path={armRpath} color={bodyShade} style="stroke" strokeWidth={2.6} strokeCap="round" />

      {/* Head — dome with visor slit */}
      <Circle cx={headCx} cy={headCy} r={headR} color={bodyMain} />
      <Circle cx={headCx} cy={headCy} r={headR} color={visor} style="stroke" strokeWidth={0.8} opacity={0.7} />
      {/* Visor slit */}
      <RoundedRect
        x={headCx - 4 + eyeOffset}
        y={headCy - 1.2}
        width={5}
        height={2.4}
        r={1}
        color={visor}
      >
        <Blur blur={1.6} />
      </RoundedRect>
      {/* Antenna */}
      <Path path={antennaPath} color={visor} style="stroke" strokeWidth={1.2} strokeCap="round" />
      <Circle cx={antennaTipX} cy={antennaTipY} r={1.6} color={visor}>
        <Blur blur={1.4} />
      </Circle>

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
