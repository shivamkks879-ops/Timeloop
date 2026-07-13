// Terms of Service page — Expo Router screen so `/terms` on the deployed
// web bundle works and Settings → Terms can link into the app.
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CYAN = "#00E5FF";
const PURPLE = "#9D00FF";
const BG = "#0A0B10";
const TEXT = "#E8EDF5";
const MUTED = "#8B95B0";

export default function TermsScreen() {
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
        <Text style={styles.title}>Terms of Service</Text>
        <View style={styles.pill}>
          <Text style={styles.pillTxt}>Updated · June 2026</Text>
        </View>

        <Text style={styles.p}>
          {`By downloading, installing, or using Time Loop Escape ("the App"), you agree to these Terms of Service. If you do not agree, please do not use the App.`}
        </Text>

        <Text style={styles.h2}>1. License</Text>
        <Text style={styles.p}>
          We grant you a personal, non-transferable, non-exclusive licence to install and
          play the App on Android devices you own or control, solely for personal,
          non-commercial entertainment.
        </Text>

        <Text style={styles.h2}>2. Restrictions</Text>
        {[
          "You may not reverse-engineer, decompile, or disassemble the App except as permitted by law.",
          "You may not distribute modified copies of the App or its assets.",
          "You may not use the App for any illegal purpose.",
        ].map((s, i) => (<Text key={i} style={styles.li}>• {s}</Text>))}

        <Text style={styles.h2}>3. Intellectual property</Text>
        <Text style={styles.p}>
          All artwork, code, level designs, music, sound effects, and other content in the
          App are owned by the developer and protected by copyright, trademark, and other
          applicable laws.
        </Text>

        <Text style={styles.h2}>4. Disclaimer of warranties</Text>
        <Text style={styles.p}>
          The App is provided <Text style={styles.b}>{`"as is"`}</Text> without warranty of any kind.
          We do not guarantee that the App will always be available, error-free, or compatible
          with every device configuration.
        </Text>

        <Text style={styles.h2}>5. Limitation of liability</Text>
        <Text style={styles.p}>
          To the maximum extent permitted by applicable law, we shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages arising from your
          use of the App.
        </Text>

        <Text style={styles.h2}>6. Changes to these terms</Text>
        <Text style={styles.p}>
          We may revise these terms from time to time. Continued use of the App after such
          changes constitutes your acceptance of the new terms.
        </Text>

        <Text style={styles.h2}>7. Governing law</Text>
        <Text style={styles.p}>
          These terms are governed by the laws of India, without regard to conflict-of-law
          principles. Any dispute shall be subject to the exclusive jurisdiction of the
          courts located in India.
        </Text>

        <Text style={styles.h2}>8. Contact</Text>
        <Text style={styles.p}>
          For questions about these Terms of Service, please contact:
          {"\n"}
          <Text style={{ color: CYAN }}>support@timeloopscope.game</Text>
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerTxt}>
            Time Loop Escape · A neon puzzle platformer · Published on Google Play
          </Text>
          <Pressable onPress={() => router.replace("/privacy" as any)}>
            <Text style={styles.link}>← Privacy Policy</Text>
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
