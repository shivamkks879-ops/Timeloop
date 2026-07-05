#!/usr/bin/env node
// Quick standalone playtest runner. Run: node scripts/playtest.js
// Since the engine is written in TS, we transpile on the fly with a tiny bundler.
// Simpler alternative: reimplement a stripped runner in JS -- but we prefer
// running the exact code. This script uses `tsx` if available.

const path = require("path");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const entry = path.join(__dirname, "playtest.entry.ts");

try {
  execSync(`npx --yes tsx ${entry}`, { stdio: "inherit", cwd: projectRoot });
} catch (e) {
  process.exit(1);
}
