import { useCallback, useState } from "react"
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native"
import { useFocusEffect } from "expo-router"
import { Screen, Card, Badge, Loading, EmptyState } from "../components/ui"
import { api } from "../lib/api"
import { theme } from "../lib/theme"
import type { Opportunity } from "../lib/types"

const TYPE_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  sell: "success",
  buy: "warning",
  hold: "default",
  trade: "default",
}

export default function AdvisorScreen() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [spark, setSpark] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ opportunities: Opportunity[]; spark?: { message: string } }>(
        "/api/ai/opportunities",
      )
      const d = res.ok && res.data ? res.data : null
      setOpportunities(d?.opportunities || [])
      setSpark(d?.spark?.message || null)
    } catch {
      setOpportunities([])
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
      <ScrollView
        contentContainerStyle={styles.content}
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
      >
        {spark ? (
          <Card style={styles.sparkCard}>
            <Text style={styles.sparkLabel}>Spark</Text>
            <Text style={styles.sparkText}>{spark}</Text>
          </Card>
        ) : null}

        {opportunities.length === 0 ? (
          <EmptyState
            title="Nessuna opportunità"
            subtitle="Aggiungi oggetti alla collezione per ricevere consigli AI."
          />
        ) : (
          opportunities.map((op, idx) => (
            <Card key={op.id || String(idx)} style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.title} numberOfLines={2}>
                  {op.title}
                </Text>
                <Badge label={op.type} tone={TYPE_TONE[op.type] || "default"} />
              </View>
              <Text style={styles.message}>{op.message}</Text>
              {typeof op.potentialValue === "number" ? (
                <Text style={styles.value}>+{op.potentialValue.toLocaleString("it-IT")} CXC potenziali</Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing.md, gap: theme.spacing.md },
  sparkCard: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  sparkLabel: { color: theme.colors.primary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  sparkText: { color: theme.colors.foreground, fontSize: 14, marginTop: 4, lineHeight: 20 },
  card: { gap: theme.spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: theme.spacing.sm },
  title: { flex: 1, color: theme.colors.foreground, fontSize: 15, fontWeight: "700" },
  message: { color: theme.colors.mutedForeground, fontSize: 13, lineHeight: 19 },
  value: { color: theme.colors.primary, fontSize: 14, fontWeight: "800" },
})
