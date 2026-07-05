import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initAudio, setMusicEnabled, setSfxEnabled, startMusic } from "@/src/game/audio";
import { loadSave } from "@/src/game/save";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";

// Silence dev logbox overlays so the game canvas stays clean.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible until icon fonts are registered.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered - which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== "web");

  // Force landscape orientation for the whole app (mobile game).
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(
      () => {}
    );
  }, []);

  // Load CanvasKit WASM on web before mounting Skia components.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    // Dynamic import so native bundles don't try to resolve web-only path.
    import("@shopify/react-native-skia/lib/module/web")
      .then((mod) =>
        mod.LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" })
      )
      .then(() => {
        if (!cancelled) setSkiaReady(true);
      })
      .catch((e) => {
        console.warn("Skia web load failed:", e);
        if (!cancelled) setSkiaReady(true); // fall through so app still boots
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if ((loaded || error) && skiaReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, skiaReady]);

  // Preload the audio pack once at boot and honour the saved audio preference.
  // Music starts on Android/iOS automatically; on web the browser may block
  // playback until the user taps something — we call startMusic() again from
  // the first UI Pressable in that case.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const save = await loadSave();
        await initAudio();
        if (cancelled) return;
        setSfxEnabled(save.audioOn);
        setMusicEnabled(save.audioOn);
        if (save.audioOn) startMusic();
        // Mirror the persisted haptics flag into the in-memory helper.
        const { setHapticsEnabled } = await import("@/src/game/haptics");
        setHapticsEnabled(save.hapticsOn);
      } catch (e) {
        if (__DEV__) console.warn("[audio] init failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if ((!loaded && !error) || !skiaReady) return null;

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0A0B10" },
          animation: "fade",
        }}
      />
    </SafeAreaProvider>
  );
}
