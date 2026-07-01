import { useCallback, useState } from "react"
import { View, Text, FlatList, StyleSheet, Image, RefreshControl } from "react-native"
import { useFocusEffect } from "expo-router"
import { Screen, Card, Badge, Loading, EmptyState } from "../components/ui"
import { api } from "../lib/api"
import { theme } from "../lib/theme"
import type { ChatThread } from "../lib/types"

function relativeTime(iso?: string): string {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return "ora"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}g`
}

export default function ChatScreen() {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ threads: ChatThread[] }>("/api/chat/threads")
      setThreads(res.ok && res.data ? res.data.threads || [] : [])
    } catch {
      setThreads([])
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
        data={threads}
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
        ListEmptyComponent={<EmptyState title="Nessuna conversazione" subtitle="Inizia una chat dal marketplace." />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            {item.otherAvatarUrl ? (
              <Image source={{ uri: item.otherAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{(item.otherName || "?").charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.info}>
              <View style={styles.topRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.otherName || "Utente"}
                </Text>
                <Text style={styles.time}>{relativeTime(item.lastMessageAt)}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage || "Nessun messaggio"}
              </Text>
            </View>
            {item.unreadCount ? <Badge label={String(item.unreadCount)} tone="danger" /> : null}
          </Card>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.md, gap: theme.spacing.sm },
  row: { flexDirection: "row", gap: theme.spacing.md, alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: theme.radius.full },
  avatarPlaceholder: { backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.colors.primaryForeground, fontSize: 20, fontWeight: "800" },
  info: { flex: 1, gap: 2 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { flex: 1, color: theme.colors.foreground, fontSize: 15, fontWeight: "700" },
  time: { color: theme.colors.mutedForeground, fontSize: 12 },
  preview: { color: theme.colors.mutedForeground, fontSize: 13 },
})
