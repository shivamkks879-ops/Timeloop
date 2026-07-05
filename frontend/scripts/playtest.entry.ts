// Entry point used by scripts/playtest.js via tsx.
import { playtestAll } from "../src/game/playtest";

const results = playtestAll();
let allPass = true;
for (const r of results) {
  if (r.status !== "pass") allPass = false;
  const line = `${r.status.toUpperCase()} ${r.levelId}  loops=${r.loopsUsed} echoes=${r.echoesUsed} grade=${r.grade ?? "-"} ticks=${r.ticksUsed}${r.reason ? "  " + r.reason : ""}`;
  console.log(line);
}
if (!allPass) {
  console.error("\nOne or more levels failed automated playtest.");
  process.exit(1);
}
console.log("\nAll levels passed automated playtest.");
