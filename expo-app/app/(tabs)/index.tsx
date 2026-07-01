import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import ListingCard from "@/components/ListingCard"
import { Button, Card, Label, Row, Title } from "@/components/ui"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"
import { fontSize, radius, spacing, useTheme } from "@/lib/theme"
import type { MarketListing } from "@/lib/types"

const QUICK_ACTIONS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: "Scansiona", icon: "scan", route: "/scan" },
  { label: "Mercato", icon: "storefront", route: "/market" },
  { label: "Aste", icon: "hammer", route: "/explore" },
  { label: "Advisor", icon: "bulb", route: "/explore" },
]

export default function HomeScreen() {
  const t = useTheme()
  const router = useRouter()
  const { user } = useAuth()
  const [listings, setListings] = useState<MarketListing[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const res = await api.get<{ listings: MarketListing[] }>("/api/market/list?page=1", false)
    if (res.ok && res.data?.listings) setListings(res.data.listings.slice(0, 6))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <View>
            <Label>Bentornato</Label>
            <Title>{user ? `@${user.username}` : "CollexBase"}</Title>
          </View>
          <Ionicons name="notifications-outline" size={26} color={t.text} />
        </Row>

        <Card style={{ marginTop: spacing.lg, backgroundColor: t.primary }}>
          <Text style={{ color: t.primaryText, fontSize: fontSize.lg, fontWeight: "800" }}>
            Scansiona una carta in 2 secondi
          </Text>
          <Text style={{ color: t.primaryText, opacity: 0.9, marginTop: spacing.xs }}>
            Valutazione AI istantanea, senza salvare nulla finché non vuoi tu.
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <Button title="Apri lo scanner" variant="ghost" onPress={() => router.push("/scan")} />
          </View>
        </Card>

        <Row style={{ marginTop: spacing.lg, flexWrap: "wrap", gap: spacing.md }}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.route as never)}
              style={{
                width: "47%",
                backgroundColor: t.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: t.border,
                padding: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <Ionicons name={a.icon} size={24} color={t.primary} />
              <Text style={{ color: t.text, fontWeight: "700" }}>{a.label}</Text>
            </Pressable>
          ))}
        </Row>

        <Text style={{ color: t.text, fontSize: fontSize.lg, fontWeight: "800", marginTop: spacing.xl }}>
          In evidenza sul mercato
        </Text>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {Array.from({ length: Math.ceil(listings.length / 2) }).map((_, rowIdx) => (
            <Row key={rowIdx} style={{ alignItems: "stretch" }}>
              {listings.slice(rowIdx * 2, rowIdx * 2 + 2).map((l) => (
                <ListingCard key={l._id} listing={l} onPress={() => router.push("/market")} />
              ))}
              {listings.slice(rowIdx * 2, rowIdx * 2 + 2).length === 1 ? <View style={{ flex: 1 }} /> : null}
            </Row>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
