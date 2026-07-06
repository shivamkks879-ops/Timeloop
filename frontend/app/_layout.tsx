import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import { useEffect, useState } from "react";
import { AppState, LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initAudio, setMusicEnabled, setSfxEnabled, startMusic } from "@/src/game/audio";
import { loadSave } from "@/src/game/save";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { loadSkiaForPlatform } from "@/src/utils/load-skia-web";

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
  // On native (Android/iOS) `loadSkiaForPlatform` is a no-op stub — the
  // web-only CanvasKit module is never referenced in the native bundle,
  // avoiding Metro trying to resolve Node's `fs` inside canvaskit-wasm.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    loadSkiaForPlatform()
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

  // Force fully-immersive Android navigation bar. On some devices the
  // `androidNavigationBar` app.json config isn't enough — we need to call the
  // runtime API too, and re-arm it whenever the app returns to foreground
  // (Android re-shows the nav bar after any system UI interaction).
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const applyImmersive = async () => {
      try {
        await NavigationBar.setVisibilityAsync("hidden");
        await NavigationBar.setBehaviorAsync("overlay-swipe");
        await NavigationBar.setBackgroundColorAsync("#0A0B10");
      } catch {
        // Older Android or unsupported device — silent noop.
      }
    };
    applyImmersive();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") applyImmersive();
    });
    return () => sub.remove();
  }, []);

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
        // Fine-grained: separate music + SFX toggles override the legacy
        // master `audioOn`. If a fresh save has both new keys default to
        // audioOn, older saves fall back to `audioOn`.
        const sfxOn = save.sfxOn ?? save.audioOn;
        const musicOn = save.musicOn ?? save.audioOn;
        setSfxEnabled(sfxOn);
        setMusicEnabled(musicOn);
        if (musicOn) startMusic();
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0B10" }}>
      <SafeAreaProvider>
        {/* Immersive fullscreen: pitch-black backdrop covers the whole window
            (including any display cutouts / notches / gesture zones) so the
            game canvas never bleeds into a white system area. */}
        <View style={{ flex: 1, backgroundColor: "#0A0B10" }}>
          <StatusBar hidden style="light" translucent backgroundColor="transparent" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0A0B10" },
              animation: "fade",
            }}
          />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
