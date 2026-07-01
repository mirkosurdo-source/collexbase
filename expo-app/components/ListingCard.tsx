import { Image } from "expo-image"
import { Pressable, Text, View } from "react-native"
import { Badge } from "@/components/ui"
import { fontSize, radius, spacing, useTheme } from "@/lib/theme"
import type { MarketListing } from "@/lib/types"

export function listingTitle(l: MarketListing): string {
  return l.itemName ?? l.title ?? l.name ?? "Oggetto"
}

export function listingImage(l: MarketListing): string | undefined {
  return l.image ?? l.imageUrl
}

export default function ListingCard({ listing, onPress }: { listing: MarketListing; onPress?: () => void }) {
  const t = useTheme()
  const img = listingImage(listing)
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: t.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        overflow: "hidden",
        flex: 1,
      }}
    >
      <View style={{ height: 120, backgroundColor: t.cardAlt }}>
        {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
      </View>
      <View style={{ padding: spacing.md }}>
        <Text numberOfLines={1} style={{ color: t.text, fontWeight: "700", fontSize: fontSize.sm }}>
          {listingTitle(listing)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs }}>
          <Text style={{ color: t.primary, fontWeight: "800" }}>€ {Math.round(listing.price ?? 0)}</Text>
          {listing.category ? <Badge text={listing.category} tone="muted" /> : null}
        </View>
      </View>
    </Pressable>
  )
}
