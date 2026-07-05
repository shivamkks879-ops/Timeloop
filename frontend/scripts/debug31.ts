// Debug harness for a specific level.
import { encodeInput, initEngine, step } from "../src/game/engine";
import { getLevel } from "../src/game/levels";

const level = getLevel("3-1")!;
let state = initEngine(level);
const script = [
  { ticks: 55, right: true },
  { ticks: 235, right: false },
  { ticks: 100, right: true },
];
let total = 0;
for (const seg of script) {
  for (let t = 0; t < seg.ticks; t++) {
    state = step(state, encodeInput(false, !!seg.right, false));
    total += 1;
    if (total <= 3 || (total >= 48 && total <= 58) || total % 20 === 0 || state.status !== "playing") {
      console.log(`t=${total} status=${state.status} loop=${state.loop} px=${state.player.x.toFixed(2)} py=${state.player.y.toFixed(2)} vx=${state.player.vx.toFixed(2)} vy=${state.player.vy.toFixed(2)} onG=${state.player.onGround} standing=${state.player.standingOn} platX=${state.platforms[0]?.px.toFixed(2)}`);
    }
    if (state.status !== "playing") break;
  }
  if (state.status !== "playing") break;
}
console.log("FINAL", state.status);
