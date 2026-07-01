import { useCallback, useState } from "react"
import { View, Text, ScrollView, StyleSheet, Image, RefreshControl } from "react-native"
import { useFocusEffect } from "expo-router"
import { Screen, Card, Button, Loading } from "../../components/ui"
import { useAuth } from "../../lib/AuthContext"
import { api } from "../../lib/api"
import { theme } from "../../lib/theme"

type ProfileData = {
  level: { level: number; title?: string }
  stats: { items: number; followers: number; collectionValue: number }
  earnedBadgeCount: number
  collection: { value: number }
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!user?.username) {
      setLoading(false)
      return
    }
    try {
      const res = await api.get<ProfileData>(`/api/profile/${encodeURIComponent(user.username)}`)
      setData(res.ok ? res.data : null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.username])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  if (loading) return <Loading />

  const cards: { label: string; value: string }[] = [
    { label: "Oggetti", value: String(data?.stats.items ?? 0) },
    { label: "Valore", value: `${(data?.collection.value ?? 0).toLocaleString("it-IT")} CXC` },
    { label: "Livello", value: String(data?.level.level ?? 1) },
    { label: "Badge", value: String(data?.earnedBadgeCount ?? 0) },
    { label: "Follower", value: String(data?.stats.followers ?? 0) },
  ]

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
        <View style={styles.header}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{(user?.name || user?.username || "?").charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name || user?.username}</Text>
          <Text style={styles.handle}>@{user?.username}</Text>
        </View>

        <View style={styles.statsGrid}>
          {cards.map((c) => (
            <Card key={c.label} style={styles.statCard}>
              <Text style={styles.statValue}>{c.value}</Text>
              <Text style={styles.statLabel}>{c.label}</Text>
            </Card>
          ))}
        </View>

        <Button title="Esci" variant="outline" onPress={signOut} style={styles.signOut} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing.md, gap: theme.spacing.lg },
  header: { alignItems: "center", gap: 6, paddingVertical: theme.spacing.md },
  avatar: { width: 88, height: 88, borderRadius: theme.radius.full },
  avatarPlaceholder: { backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.colors.primaryForeground, fontSize: 34, fontWeight: "800" },
  name: { color: theme.colors.foreground, fontSize: 20, fontWeight: "800" },
  handle: { color: theme.colors.mutedForeground, fontSize: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  statCard: { flexBasis: "48%", flexGrow: 1, alignItems: "center", gap: 2 },
  statValue: { color: theme.colors.primary, fontSize: 20, fontWeight: "800" },
  statLabel: { color: theme.colors.mutedForeground, fontSize: 12, textTransform: "uppercase", fontWeight: "700" },
  signOut: { marginTop: theme.spacing.md },
})
