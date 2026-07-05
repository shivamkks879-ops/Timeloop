import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
