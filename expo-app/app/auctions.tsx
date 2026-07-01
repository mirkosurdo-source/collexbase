import { useCallback, useState } from "react"
import { View, Text, FlatList, StyleSheet, Image, RefreshControl } from "react-native"
import { useFocusEffect } from "expo-router"
import { Screen, Card, Badge, Loading, EmptyState } from "../components/ui"
import { api } from "../lib/api"
import { theme } from "../lib/theme"
import type { Auction } from "../lib/types"

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return "Terminata"
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}g ${h % 24}h`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function AuctionsScreen() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ auctions: Auction[] }>("/api/auctions/list?status=active")
      setAuctions(res.ok && res.data ? res.data.auctions || [] : [])
    } catch {
      setAuctions([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  if (loading) return <Loading />

  return (
    <Screen padded={false}>
      <FlatList
        data={auctions}
        keyExtractor={(a) => a._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              load()
            }}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState title="Nessuna asta attiva" subtitle="Torna più tardi per nuove aste." />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.imgPlaceholder]} />
            )}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.itemName}
              </Text>
              <Text style={styles.bid}>
                {(item.currentBid ?? item.startingPrice).toLocaleString("it-IT")} CXC
              </Text>
              <View style={styles.metaRow}>
                <Badge label={`${item.bidCount ?? 0} offerte`} />
                <Badge label={timeLeft(item.endsAt)} tone="warning" />
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.md, gap: theme.spacing.md },
  row: { flexDirection: "row", gap: theme.spacing.md, alignItems: "center" },
  img: { width: 64, height: 64, borderRadius: theme.radius.md },
  imgPlaceholder: { backgroundColor: theme.colors.muted },
  info: { flex: 1, gap: 4 },
  name: { color: theme.colors.foreground, fontSize: 15, fontWeight: "700" },
  bid: { color: theme.colors.primary, fontSize: 16, fontWeight: "800" },
  metaRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: 2 },
})
