import { useCallback, useState } from "react"
import { View, Text, FlatList, StyleSheet, Image, RefreshControl } from "react-native"
import { useFocusEffect } from "expo-router"
import { Screen, Card, Badge, Loading, EmptyState } from "../components/ui"
import { api } from "../lib/api"
import { theme } from "../lib/theme"
import type { Showcase } from "../lib/types"

export default function ShowcasesScreen() {
  const [showcases, setShowcases] = useState<Showcase[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ featured: Showcase[]; trending: Showcase[] }>("/api/showcase/discover")
      const d = res.ok && res.data ? res.data : { featured: [], trending: [] }
      const merged = [...(d.featured || []), ...(d.trending || [])]
      const unique = Array.from(new Map(merged.map((s) => [s._id, s])).values())
      setShowcases(unique)
    } catch {
      setShowcases([])
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
        data={showcases}
        keyExtractor={(s) => s._id}
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
        ListEmptyComponent={<EmptyState title="Nessuna vetrina" subtitle="Le vetrine in evidenza appariranno qui." />}
        renderItem={({ item }) => (
          <Card padded={false} style={styles.card}>
            {item.coverImageUrl ? (
              <Image source={{ uri: item.coverImageUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]} />
            )}
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.owner} numberOfLines={1}>
                @{item.username}
              </Text>
              <View style={styles.metaRow}>
                {item.theme ? <Badge label={item.theme} /> : null}
                <Badge label={`${item.followerCount ?? 0} follower`} tone="success" />
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
  card: { overflow: "hidden" },
  cover: { width: "100%", height: 140 },
  coverPlaceholder: { backgroundColor: theme.colors.muted },
  body: { padding: theme.spacing.md, gap: 4 },
  title: { color: theme.colors.foreground, fontSize: 16, fontWeight: "800" },
  owner: { color: theme.colors.mutedForeground, fontSize: 13 },
  metaRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: 4 },
})
