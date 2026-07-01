import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Alert, Pressable, Text, View } from "react-native"
import { Badge, Button, Card, EmptyState, Label, Loading, Row, Screen, Subtitle, Title } from "@/components/ui"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"
import { fontSize, radius, spacing, useTheme } from "@/lib/theme"
import type { DetectedCard, MultiScanResult, SingleScanResult } from "@/lib/types"

type Mode = "single" | "multi"

export default function ScanScreen() {
  const t = useTheme()
  const router = useRouter()
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>("single")
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [single, setSingle] = useState<SingleScanResult | null>(null)
  const [multi, setMulti] = useState<MultiScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setSingle(null)
    setMulti(null)
    setError(null)
  }

  async function pickFrom(source: "camera" | "library") {
    reset()
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert("Permesso negato", "Consenti l'accesso per scansionare le carte.")
      return
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true })
    if (result.canceled || !result.assets?.length) return
    const asset = result.assets[0]
    setImageUri(asset.uri)
    const dataUrl = asset.base64 ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}` : asset.uri
    void analyze(dataUrl)
  }

  async function analyze(imageUrl: string) {
    if (!user) {
      router.push("/login")
      return
    }
    setLoading(true)
    setError(null)
    const res = await api.post<SingleScanResult | MultiScanResult>("/api/scan", { mode, imageUrl })
    setLoading(false)
    if (!res.ok || !res.data?.success) {
      setError(res.error ?? "Scansione non riuscita. Riprova con più luce.")
      return
    }
    if (mode === "multi") setMulti(res.data as MultiScanResult)
    else setSingle(res.data as SingleScanResult)
  }

  async function addToCollection(item: {
    name: string
    category?: string | null
    condition?: string
    value: number
    image?: string
  }) {
    const res = await api.post("/api/collections/create", {
      name: item.name,
      category: item.category ?? "",
      condition: item.condition ?? "",
      value: item.value,
      image: item.image ?? imageUri ?? "",
    })
    if (res.ok) Alert.alert("Aggiunto", `${item.name} è stato aggiunto alla tua collezione.`)
    else Alert.alert("Errore", res.error ?? "Impossibile aggiungere l'oggetto.")
  }

  return (
    <Screen>
      <Title>Scanner</Title>
      <Subtitle>Valutazioni AI istantanee. Niente viene salvato finché non lo aggiungi tu.</Subtitle>

      <Row style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <ModeChip label="Carta singola" active={mode === "single"} onPress={() => setMode("single")} />
        <ModeChip label="Multi-carta" active={mode === "multi"} onPress={() => setMode("multi")} />
      </Row>

      <Card style={{ marginTop: spacing.lg, alignItems: "center" }}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: "100%", height: 220, borderRadius: radius.md }} contentFit="cover" />
        ) : (
          <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Ionicons name="scan-outline" size={56} color={t.primary} />
            <Text style={{ color: t.textMuted, marginTop: spacing.sm }}>Inquadra una o più carte</Text>
          </View>
        )}
        <Row style={{ marginTop: spacing.lg, width: "100%" }}>
          <View style={{ flex: 1 }}>
            <Button title="Fotocamera" onPress={() => pickFrom("camera")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Galleria" variant="outline" onPress={() => pickFrom("library")} />
          </View>
        </Row>
      </Card>

      {loading ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Loading />
          <Text style={{ color: t.textMuted, textAlign: "center" }}>CollexSpark sta analizzando…</Text>
        </Card>
      ) : null}

      {error ? (
        <Card style={{ marginTop: spacing.lg, borderColor: t.danger }}>
          <Text style={{ color: t.danger }}>{error}</Text>
        </Card>
      ) : null}

      {single ? <SingleResult result={single} onAdd={addToCollection} /> : null}
      {multi ? <MultiResult result={multi} onAdd={addToCollection} /> : null}
    </Screen>
  )
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? t.primary : t.cardAlt,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      }}
    >
      <Text style={{ color: active ? t.primaryText : t.textMuted, fontWeight: "700", fontSize: fontSize.sm }}>
        {label}
      </Text>
    </Pressable>
  )
}

function SparkBubble({ message }: { message: string }) {
  const t = useTheme()
  return (
    <View style={{ backgroundColor: t.sparkSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
      <Row>
        <Ionicons name="sparkles" size={18} color={t.spark} />
        <Text style={{ color: t.text, flex: 1, fontSize: fontSize.sm }}>{message}</Text>
      </Row>
    </View>
  )
}

function trendLabel(trend: "up" | "stable" | "down", pct: number) {
  const sign = pct >= 0 ? "+" : ""
  if (trend === "up") return `In crescita ${sign}${pct}%`
  if (trend === "down") return `In calo ${sign}${pct}%`
  return "Stabile"
}

function SingleResult({
  result,
  onAdd,
}: {
  result: SingleScanResult
  onAdd: (i: { name: string; category?: string | null; condition?: string; value: number }) => void
}) {
  const t = useTheme()
  const { identification: id, value, grading, advisor, spark, isRare } = result
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Text style={{ color: t.text, fontSize: fontSize.xl, fontWeight: "800", flex: 1 }}>{id.name}</Text>
        {isRare ? <Badge text="Raro" tone="spark" /> : null}
      </Row>
      {id.series || id.set ? (
        <Text style={{ color: t.textMuted, marginTop: 2 }}>{[id.series, id.set].filter(Boolean).join(" · ")}</Text>
      ) : null}

      <View style={{ margintop: spacing.lg, marginTop: spacing.lg }}>
        <Label>Valore stimato</Label>
        <Text style={{ color: t.primary, fontSize: fontSize.display, fontWeight: "800" }}>€ {Math.round(value.estimated)}</Text>
        <Text style={{ color: t.textMuted }}>
          Range € {Math.round(value.min)}–{Math.round(value.max)} · {trendLabel(value.trend, value.trendPercent)}
        </Text>
      </View>

      <Row style={{ marginTop: spacing.md, flexWrap: "wrap" }}>
        {id.rarity ? <Badge text={id.rarity} tone="muted" /> : null}
        {grading.condition ? <Badge text={grading.condition} tone="muted" /> : null}
        {advisor.auctionRecommended ? <Badge text="Consigliata asta" tone="spark" /> : null}
        {advisor.sellNow ? <Badge text="Vendi ora" tone="success" /> : null}
        {advisor.hold ? <Badge text="Mantieni" tone="muted" /> : null}
      </Row>

      <Text style={{ color: t.textMuted, marginTop: spacing.md, fontSize: fontSize.sm }}>{advisor.reason}</Text>

      <SparkBubble message={spark.message} />

      <View style={{ marginTop: spacing.lg }}>
        <Button
          title="Aggiungi alla collezione"
          onPress={() =>
            onAdd({ name: id.name, category: id.category, condition: grading.condition, value: value.estimated })
          }
        />
      </View>
    </Card>
  )
}

function MultiResult({
  result,
  onAdd,
}: {
  result: MultiScanResult
  onAdd: (i: { name: string; category?: string | null; condition?: string; value: number }) => void
}) {
  const t = useTheme()
  if (!result.count) return <EmptyState message="Nessuna carta rilevata. Riprova con più luce." />
  return (
    <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
      <Card>
        <Label>Totale rilevato</Label>
        <Text style={{ color: t.primary, fontSize: fontSize.xxl, fontWeight: "800" }}>
          € {Math.round(result.totalValue)}
        </Text>
        <Text style={{ color: t.textMuted }}>
          {result.count} carte · range € {Math.round(result.totalMin)}–{Math.round(result.totalMax)}
        </Text>
        <SparkBubble message={result.spark.message} />
      </Card>

      {result.cards.map((c: DetectedCard) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: t.text, fontWeight: "700", flex: 1 }}>{c.name}</Text>
            {c.isRare ? <Badge text="Raro" tone="spark" /> : null}
          </Row>
          <Text style={{ color: t.textMuted, fontSize: fontSize.sm }}>{c.position}</Text>
          <Row style={{ justifyContent: "space-between", marginTop: spacing.sm }}>
            <Text style={{ color: t.primary, fontWeight: "800", fontSize: fontSize.lg }}>
              € {Math.round(c.estimatedValue)}
            </Text>
            <Pressable onPress={() => onAdd({ name: c.name, condition: c.condition, value: c.estimatedValue })}>
              <Row>
                <Ionicons name="add-circle-outline" size={20} color={t.primary} />
                <Text style={{ color: t.primary, fontWeight: "700" }}>Aggiungi</Text>
              </Row>
            </Pressable>
          </Row>
        </Card>
      ))}
    </View>
  )
}
