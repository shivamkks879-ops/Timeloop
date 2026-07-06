// Native (Android/iOS) stub — Skia is loaded natively via the Expo config
// plugin, so there is nothing to do at runtime. This file exists purely so
// that Metro can resolve the import at bundle-time without walking into the
// web-only CanvasKit WASM loader (which imports Node's `fs`).

export async function loadSkiaForPlatform(): Promise<void> {
  // no-op on native
  return;
}
