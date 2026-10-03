#!/usr/bin/env node
/**
 * Auto-apply node_modules patches after every `yarn install`.
 *
 * Why a wrapper instead of calling `patch-package` directly:
 *   1. Windows-safe — spawns the local binary via node instead of
 *      relying on .cmd shim resolution in PowerShell.
 *   2. Non-fatal when there are no patches yet — fresh clones (and CI)
 *      shouldn't fail just because the patches/ folder is empty.
 *   3. Verbose logging so the install log clearly shows which library
 *      patches were applied (handy when debugging local Android builds).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const patchesDir = path.join(__dirname, "..", "patches");

const hasPatches =
  fs.existsSync(patchesDir) &&
  fs.readdirSync(patchesDir).some((f) => f.endsWith(".patch"));

if (!hasPatches) {
  console.log("[apply-patches] No patches found — skipping.");
  process.exit(0);
}

const bin = path.join(
  __dirname,
  "..",
  "node_modules",
  "patch-package",
  "index.js",
);

if (!fs.existsSync(bin)) {
  console.warn("[apply-patches] patch-package not installed — skipping.");
  process.exit(0);
}

console.log("[apply-patches] Applying node_modules patches…");
const res = spawnSync(process.execPath, [bin], { stdio: "inherit" });
process.exit(res.status === 0 ? 0 : 1);
