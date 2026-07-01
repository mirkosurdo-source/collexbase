import { useCallback, useState } from "react"
import { View, Text, FlatList, StyleSheet, Image, RefreshControl } from "react-native"
import { useFocusEffect } from "expo-router"
import { Screen, Card, Badge, Loading, EmptyState } from "../components/ui"
import { api } from "../lib/api"
import { theme } from "../lib/theme"
import type { Group } from "../lib/types"

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ groups: Group[] }>("/api/groups/mine")
      setGroups(res.ok && res.data ? res.data.groups || [] : [])
    } catch {
      setGroups([])
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
        data={groups}
        keyExtractor={(g) => g._id}
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
        ListEmptyComponent={
          <EmptyState title="Nessun gruppo" subtitle="Unisciti a un gruppo dal web per vederlo qui." />
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.description ? (
                <Text style={styles.desc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <Badge label={`${item.memberCount ?? 0} membri`} />
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
  avatar: { width: 56, height: 56, borderRadius: theme.radius.full },
  avatarPlaceholder: { backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.colors.primaryForeground, fontSize: 22, fontWeight: "800" },
  info: { flex: 1, gap: 4 },
  name: { color: theme.colors.foreground, fontSize: 15, fontWeight: "700" },
  desc: { color: theme.colors.mutedForeground, fontSize: 13 },
})
