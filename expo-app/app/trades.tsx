import { useCallback, useState } from "react"
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native"
import { useFocusEffect } from "expo-router"
import { Screen, Card, Badge, Loading, EmptyState } from "../components/ui"
import { api } from "../lib/api"
import { theme } from "../lib/theme"
import type { Trade } from "../lib/types"

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  pending: "warning",
  accepted: "success",
  completed: "success",
  rejected: "danger",
  cancelled: "danger",
}

const STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettato",
  completed: "Completato",
  rejected: "Rifiutato",
  cancelled: "Annullato",
}

export default function TradesScreen() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ trades: Trade[] }>("/api/trades/list")
      setTrades(res.ok && res.data ? res.data.trades || [] : [])
    } catch {
      setTrades([])
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
        data={trades}
        keyExtractor={(t) => t._id}
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
        ListEmptyComponent={<EmptyState title="Nessuno scambio" subtitle="Le tue proposte di scambio appariranno qui." />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.counterparty} numberOfLines={1}>
                {item.counterpartyName || "Scambio"}
              </Text>
              <Badge label={STATUS_LABEL[item.status] || item.status} tone={STATUS_TONE[item.status] || "default"} />
            </View>
            <View style={styles.exchange}>
              <View style={styles.side}>
                <Text style={styles.sideLabel}>Offri</Text>
                <Text style={styles.sideItems} numberOfLines={2}>
                  {(item.offeredItems || []).map((i) => i.name).join(", ") || "—"}
                </Text>
              </View>
              <Text style={styles.arrow}>⇄</Text>
              <View style={styles.side}>
                <Text style={styles.sideLabel}>Ricevi</Text>
                <Text style={styles.sideItems} numberOfLines={2}>
                  {(item.requestedItems || []).map((i) => i.name).join(", ") || "—"}
                </Text>
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
  card: { gap: theme.spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  counterparty: { flex: 1, color: theme.colors.foreground, fontSize: 15, fontWeight: "700" },
  exchange: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  side: { flex: 1, gap: 2 },
  sideLabel: { color: theme.colors.mutedForeground, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  sideItems: { color: theme.colors.foreground, fontSize: 13 },
  arrow: { color: theme.colors.primary, fontSize: 20, fontWeight: "800" },
})
