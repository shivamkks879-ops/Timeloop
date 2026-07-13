// Privacy Policy page — same content as `/api/legal/privacy` (backend HTML)
// but rendered as an Expo Router web/native screen so `/privacy` on the
// deployed web bundle no longer shows "Unmatched Route". Also accessible
// in-app via Settings → Privacy Policy.
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CYAN = "#00E5FF";
const PURPLE = "#9D00FF";
const BG = "#0A0B10";
const TEXT = "#E8EDF5";
const MUTED = "#8B95B0";

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/" as any)} style={styles.back}>
          <Text style={styles.backTxt}>{"← Back"}</Text>
        </Pressable>

        <Text style={styles.brand}>
          TIME LOOP <Text style={{ color: CYAN }}>ESCAPE</Text>
        </Text>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={styles.pill}>
          <Text style={styles.pillTxt}>Updated · June 2026</Text>
        </View>

        <Text style={styles.p}>
          {`Time Loop Escape ("the App", "we", "us") respects your privacy. This policy explains what data the App collects, why it collects it, and how it is stored.`}
        </Text>

        <Text style={styles.h2}>1. Data we do NOT collect</Text>
        <Text style={styles.p}>
          Time Loop Escape is a <Text style={styles.b}>fully offline single-player game</Text>.
          We do not collect, transmit, or store on any server:
        </Text>
        {[
          "Personal information (name, email address, phone number).",
          "Contacts, photos, camera, microphone, or location data.",
          "Analytics identifiers, advertising IDs, or third-party trackers.",
          "Any information that could identify you personally.",
        ].map((s, i) => (
          <Text key={i} style={styles.li}>• {s}</Text>
        ))}

        <Text style={styles.h2}>2. Data we DO store — locally, on your device only</Text>
        <Text style={styles.p}>
          The following gameplay data is saved on-device using Android&apos;s private AsyncStorage
          sandbox. It never leaves your device unless you opt-in to a future cloud-save
          feature (currently not enabled):
        </Text>
        {[
          "Level completion state (which levels are cleared, their grades and stars).",
          "Lifetime statistics (total playtime, deaths, echoes used, fastest clear time).",
          "Settings preferences (music/SFX, haptics, one-thumb mode, screen-shake, palette, skin).",
          "Unlocked skins and earned achievements.",
        ].map((s, i) => (
          <Text key={i} style={styles.li}>• {s}</Text>
        ))}
        <Text style={styles.p}>
          You can wipe all of the above at any time via <Text style={styles.b}>Settings → Reset Progress</Text>.
        </Text>

        <Text style={styles.h2}>3. Permissions</Text>
        <Text style={styles.p}>
          Time Loop Escape declares only the minimum Android permissions required to run:
        </Text>
        <Text style={styles.li}>• <Text style={styles.b}>VIBRATE</Text> — for haptic feedback on jumps, deaths, and rewinds. Can be turned off in Settings.</Text>
        <Text style={styles.p}>
          No network permissions are required for gameplay. The App does not open sockets or
          make outbound requests during play.
        </Text>

        <Text style={styles.h2}>4. Children&apos;s privacy</Text>
        <Text style={styles.p}>
          The App is rated for everyone and contains no advertising, in-app purchases, chat,
          user-generated content, or social features. It complies with Google Play&apos;s Families
          policy and is safe for players of all ages.
        </Text>

        <Text style={styles.h2}>5. Third-party services</Text>
        <Text style={styles.p}>
          No third-party analytics, advertising, or crash-reporting services are integrated
          in the current release. Should any be added in a future version, this policy will
          be updated and a clear in-app notice shown before any data leaves your device.
        </Text>

        <Text style={styles.h2}>6. Data retention & deletion</Text>
        <Text style={styles.p}>
          Because no data is collected on our servers, there is nothing for us to retain or
          delete about you. Any local data can be removed instantly by uninstalling the App
          or by using Settings → Reset Progress.
        </Text>

        <Text style={styles.h2}>7. Changes to this policy</Text>
        <Text style={styles.p}>
          Any changes will be announced in the release notes on the Google Play Store and
          reflected on this page. Continued use of the App after an update constitutes
          acceptance of the updated policy.
        </Text>

        <Text style={styles.h2}>8. Contact</Text>
        <Text style={styles.p}>
          For any questions or concerns about this Privacy Policy, please contact:
          {"\n"}
          <Text style={{ color: CYAN }}>support@timeloopscope.game</Text>
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerTxt}>
            Time Loop Escape · A neon puzzle platformer · Published on Google Play
          </Text>
          <Pressable onPress={() => router.replace("/terms" as any)}>
            <Text style={styles.link}>Terms of Service →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  wrap: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 80, maxWidth: 780, alignSelf: "center", width: "100%" },
  back: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,229,255,0.35)", marginBottom: 20 },
  backTxt: { color: CYAN, fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  brand: { color: MUTED, fontSize: 12, letterSpacing: 3, fontWeight: "800", marginBottom: 6 },
  title: { color: "#fff", fontSize: 34, fontWeight: "900", letterSpacing: 1, marginBottom: 10 },
  pill: { alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: PURPLE, backgroundColor: "rgba(157,0,255,0.15)", marginBottom: 20 },
  pillTxt: { color: "#E0A0FF", fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  h2: { color: CYAN, fontSize: 18, fontWeight: "800", letterSpacing: 0.5, marginTop: 26, marginBottom: 8 },
  p: { color: TEXT, fontSize: 15, lineHeight: 24, marginBottom: 10 },
  li: { color: TEXT, fontSize: 15, lineHeight: 24, marginLeft: 12, marginBottom: 4 },
  b: { color: "#fff", fontWeight: "800" },
  footer: { marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: "rgba(0,229,255,0.15)" },
  footerTxt: { color: MUTED, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  link: { color: CYAN, fontSize: 14, fontWeight: "700" },
});
