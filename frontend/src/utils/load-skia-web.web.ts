// Web-only Skia loader. Metro's platform-extension resolver picks this file
// when bundling for `web`, and the sibling `load-skia-web.ts` (no-op) when
// bundling for `android` / `ios`. This keeps `canvaskit-wasm` (which
// `require("fs")`) completely out of native bundles.

export async function loadSkiaForPlatform(): Promise<void> {
  const mod = await import("@shopify/react-native-skia/lib/module/web");
  await mod.LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" });
}
