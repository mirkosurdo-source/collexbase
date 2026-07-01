import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"
import { Row, Screen, Subtitle, Title } from "@/components/ui"
import { fontSize, radius, spacing, useTheme } from "@/lib/theme"

const SECTIONS: { label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: "Aste", desc: "Offri e aggiudicati pezzi rari", icon: "hammer-outline", route: "/auctions" },
  { label: "Scambi", desc: "Proposte di scambio in entrata e uscita", icon: "swap-horizontal-outline", route: "/trades" },
  { label: "Gruppi", desc: "Le tue community di collezionisti", icon: "people-outline", route: "/groups" },
  { label: "Vetrine", desc: "Mostra e scopri collezioni", icon: "albums-outline", route: "/showcases" },
  { label: "Advisor AI", desc: "Consigli e opportunità su misura", icon: "bulb-outline", route: "/advisor" },
  { label: "Messaggi", desc: "Chatta con altri collezionisti", icon: "chatbubbles-outline", route: "/chat" },
]

export default function ExploreScreen() {
  const t = useTheme()
  const router = useRouter()
  return (
    <Screen>
      <Title>Esplora</Title>
      <Subtitle>Tutto l&apos;ecosistema CollexBase in un posto.</Subtitle>
      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {SECTIONS.map((s) => (
          <Pressable
            key={s.route}
            onPress={() => router.push(s.route as never)}
            style={{
              backgroundColor: t.card,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.border,
              padding: spacing.lg,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Row style={{ flex: 1 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: t.cardAlt,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={s.icon} size={22} color={t.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: "700", fontSize: fontSize.md }}>{s.label}</Text>
                  <Text style={{ color: t.textMuted, fontSize: fontSize.sm }}>{s.desc}</Text>
                </View>
              </Row>
              <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
            </Row>
          </Pressable>
        ))}
      </View>
    </Screen>
  )
}
