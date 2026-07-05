import { encodeInput, initEngine, step } from "../src/game/engine";
import { getLevel } from "../src/game/levels";

const level = getLevel("3-2")!;
let state = initEngine(level);
const script = [
  { ticks: 25, right: true },
  { ticks: 575, right: false },
  { ticks: 55, right: true },
  { ticks: 200, right: false },
  { ticks: 150, right: true },
];
let total = 0;
for (const seg of script) {
  for (let t = 0; t < seg.ticks; t++) {
    state = step(state, encodeInput(false, !!seg.right, false));
    total += 1;
    if (total <= 30 || (total >= 600 && total <= 700 && total % 5 === 0) || total % 50 === 0 || state.status !== "playing") {
      const ech = state.echoes[0];
      console.log(`t=${total} L${state.loop} px=${state.player.x.toFixed(1)} py=${state.player.y.toFixed(1)} vx=${state.player.vx.toFixed(1)} onG=${state.player.onGround} st=${state.player.standingOn} pl=${state.platforms[0]?.px.toFixed(1)} plP=${state.platesPressed.size} echoX=${ech?.x.toFixed(1)} echoAlive=${ech?.alive} status=${state.status}`);
    }
    if (state.status !== "playing") break;
  }
  if (state.status !== "playing") break;
}
