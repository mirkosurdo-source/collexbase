import { useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import ListingCard from "@/components/ListingCard"
import { EmptyState, Loading, Row, Title } from "@/components/ui"
import { api } from "@/lib/api"
import { fontSize, radius, spacing, useTheme } from "@/lib/theme"
import type { MarketListing } from "@/lib/types"

const CATEGORIES = ["Tutti", "Pokémon", "Magic", "Yu-Gi-Oh!", "Sport", "Funko", "Altro"]

export default function MarketScreen() {
  const t = useTheme()
  const router = useRouter()
  const [listings, setListings] = useState<MarketListing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("Tutti")

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: "1" })
    if (category !== "Tutti") params.set("category", category)
    if (query.trim()) params.set("q", query.trim())
    const res = await api.get<{ listings: MarketListing[] }>(`/api/market/list?${params.toString()}`, false)
    setListings(res.ok && res.data?.listings ? res.data.listings : [])
    setLoading(false)
  }, [category, query])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={["top", "left", "right"]}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Mercato</Title>
        <TextInput
          placeholder="Cerca carte, set, venditori…"
          placeholderTextColor={t.textMuted}
          value={query}
          onChangeText={setQuery}
          style={{
            backgroundColor: t.cardAlt,
            color: t.text,
            borderRadius: radius.md,
            padding: spacing.md,
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: t.border,
          }}
        />
        <Row style={{ marginTop: spacing.md, flexWrap: "wrap", gap: spacing.sm }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={{
                backgroundColor: category === c ? t.primary : t.cardAlt,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: category === c ? t.primaryText : t.textMuted, fontSize: fontSize.xs, fontWeight: "700" }}>
                {c}
              </Text>
            </Pressable>
          ))}
        </Row>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l._id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          ListEmptyComponent={<EmptyState message="Nessun annuncio trovato." />}
          renderItem={({ item }) => <ListingCard listing={item} onPress={() => router.push("/market")} />}
        />
      )}
    </SafeAreaView>
  )
}
