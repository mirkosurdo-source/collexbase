import { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import Showcase from "@/lib/models/Showcase"
import ShowcaseFollow from "@/lib/models/ShowcaseFollow"
import CollectionItem from "@/lib/models/Collection"
import User from "@/lib/models/User"
import { normalizeItem, type RawItem } from "@/lib/collection-helpers"

/** Canonical thematic labels for showcases (Blocco 32). */
export const SHOWCASE_THEMES = [
  "Pokémon",
  "Magic",
  "Yu-Gi-Oh",
  "Funko",
  "Calciatori",
  "Anime",
  "Vintage",
  "Sport",
  "Comics",
  "Custom",
] as const

export type ShowcaseVisibility = "public" | "private" | "disabled"

export const MAX_FEATURED_ITEMS = 12

function toObjectId(id: string): Types.ObjectId | string {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

const RARITY_RANK: Record<string, number> = {
  leggendaria: 5,
  leggendario: 5,
  epica: 4,
  epico: 4,
  rara: 3,
  raro: 3,
  "non comune": 2,
  comune: 1,
}
export const rarityRank = (r: string) => RARITY_RANK[r.toLowerCase()] ?? 0

export interface ShowcaseItemDTO {
  id: string
  name: string
  image: string
  category: string
  rarity: string
  currentValue: number
  forSale: boolean
  forTrade: boolean
}

export interface ShowcaseAnalysis {
  exposedCount: number
  exposedValue: number
  rareCount: number
  themes: number
  duplicates: number
  trendPct: number
  featured: ShowcaseItemDTO[]
  rarest: ShowcaseItemDTO[]
  topValued: ShowcaseItemDTO[]
  wanted: ShowcaseItemDTO[]
}

export interface ShowcaseDTO {
  userId: string
  username: string
  title: string
  description: string
  theme: string
  visibility: ShowcaseVisibility
  followerCount: number
  isOwner: boolean
  isFollowing: boolean
  analysis: ShowcaseAnalysis
}

function toItemDTO(i: ReturnType<typeof normalizeItem>): ShowcaseItemDTO {
  return {
    id: i.id,
    name: i.name,
    image: i.image,
    category: i.category,
    rarity: i.rarity,
    currentValue: i.currentValue,
    forSale: i.forSale,
    forTrade: i.forTrade,
  }
}

/**
 * Computes the full analysis for a user's collection in showcase terms. Honors
 * the explicit `featuredItems` ordering when present, otherwise falls back to
 * the most valuable items. Reuses normalizeItem so values/rarity stay
 * consistent with the rest of the app.
 */
export async function computeShowcaseAnalysis(userId: string, featuredIds: string[] = []): Promise<ShowcaseAnalysis> {
  await connectDB()
  const oid = toObjectId(userId)
  const raw = (await CollectionItem.find({ userId: oid }).lean()) as RawItem[]
  const items = raw.map(normalizeItem)
  const byId = new Map(items.map((i) => [i.id, i]))

  // Featured selection: explicit order first, else top valued (max 12).
  let featured: ReturnType<typeof normalizeItem>[]
  if (featuredIds.length) {
    featured = featuredIds.map((id) => byId.get(id)).filter(Boolean).slice(0, MAX_FEATURED_ITEMS) as ReturnType<
      typeof normalizeItem
    >[]
  } else {
    featured = [...items].sort((a, b) => b.currentValue - a.currentValue).slice(0, MAX_FEATURED_ITEMS)
  }

  const rarest = [...items]
    .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.currentValue - a.currentValue)
    .slice(0, 6)
  const topValued = [...items].sort((a, b) => b.currentValue - a.currentValue).slice(0, 6)
  // "Più ricercati" — items the owner has flagged as available (on the market).
  const wanted = items.filter((i) => i.forSale || i.forTrade).slice(0, 6)

  // Duplicates by normalized name.
  const seen = new Map<string, number>()
  for (const i of items) {
    const key = i.name.trim().toLowerCase()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  let duplicates = 0
  for (const c of seen.values()) if (c > 1) duplicates += c - 1

  const exposedCount = featured.length
  const exposedValue = featured.reduce((s, i) => s + i.currentValue, 0)
  const rareCount = featured.filter((i) => rarityRank(i.rarity) >= 3).length
  const themes = new Set(featured.map((i) => i.category.toLowerCase())).size

  // Trend across the featured items' value history (first vs last point).
  let first = 0
  let last = 0
  for (const i of featured) {
    const h = i.valueHistory
    if (h.length) {
      first += h[0].value
      last += h[h.length - 1].value
    }
  }
  const trendPct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0

  return {
    exposedCount,
    exposedValue,
    rareCount,
    themes,
    duplicates,
    trendPct,
    featured: featured.map(toItemDTO),
    rarest: rarest.map(toItemDTO),
    topValued: topValued.map(toItemDTO),
    wanted: wanted.map(toItemDTO),
  }
}

/** Badge-engine metrics derived from a user's showcase (Blocco 32). */
export interface ShowcaseBadgeMetrics {
  showcaseExposedItems: number
  showcaseThemes: number
  showcaseRareItems: number
  showcaseExposedValue: number
}

export async function gatherShowcaseBadgeMetrics(userId: string): Promise<ShowcaseBadgeMetrics> {
  await connectDB()
  const sc = await Showcase.findOne({ userId: toObjectId(userId) }).lean<{ featuredItems?: unknown[]; visibility?: string }>()
  // Only public showcases count toward exposition badges.
  if (!sc || sc.visibility === "disabled") {
    return { showcaseExposedItems: 0, showcaseThemes: 0, showcaseRareItems: 0, showcaseExposedValue: 0 }
  }
  const featuredIds = (sc.featuredItems || []).map((x) => String(x))
  const a = await computeShowcaseAnalysis(userId, featuredIds)
  return {
    showcaseExposedItems: a.exposedCount,
    showcaseThemes: a.themes,
    showcaseRareItems: a.rareCount,
    showcaseExposedValue: a.exposedValue,
  }
}

/** Lightweight card summary used by discovery and recommendation lists. */
export interface ShowcaseSummary {
  userId: string
  username: string
  title: string
  theme: string
  followerCount: number
  coverImage: string
  itemCount: number
}

async function toSummary(sc: Record<string, unknown>): Promise<ShowcaseSummary> {
  const featuredIds = ((sc.featuredItems as unknown[]) || []).map((x) => String(x))
  let coverImage = ""
  if (featuredIds.length) {
    const first = (await CollectionItem.findById(featuredIds[0]).select("image").lean()) as { image?: string } | null
    coverImage = first?.image || ""
  }
  return {
    userId: String(sc.userId),
    username: String(sc.username || ""),
    title: String(sc.title || "Vetrina"),
    theme: String(sc.theme || "Custom"),
    followerCount: Number(sc.followerCount || 0),
    coverImage,
    itemCount: featuredIds.length,
  }
}

/** Discovery feed: popular, new, and per-theme public showcases. */
export async function getShowcaseDiscovery(theme?: string): Promise<{
  popular: ShowcaseSummary[]
  fresh: ShowcaseSummary[]
  byTheme: ShowcaseSummary[]
}> {
  await connectDB()
  const base = { visibility: "public" as const }
  const [popularDocs, freshDocs, themeDocs] = await Promise.all([
    Showcase.find(base).sort({ followerCount: -1, updatedAt: -1 }).limit(12).lean(),
    Showcase.find(base).sort({ createdAt: -1 }).limit(12).lean(),
    theme ? Showcase.find({ ...base, theme }).sort({ followerCount: -1 }).limit(12).lean() : Promise.resolve([]),
  ])
  const [popular, fresh, byTheme] = await Promise.all([
    Promise.all((popularDocs as Record<string, unknown>[]).map(toSummary)),
    Promise.all((freshDocs as Record<string, unknown>[]).map(toSummary)),
    Promise.all((themeDocs as Record<string, unknown>[]).map(toSummary)),
  ])
  return { popular, fresh, byTheme }
}

/**
 * Recommends public showcases relevant to a viewer, by matching the viewer's
 * dominant collection categories against showcase themes, then falling back to
 * the most-followed showcases. Excludes the viewer's own showcase.
 */
export async function getRecommendedShowcases(userId: string, limit = 6): Promise<ShowcaseSummary[]> {
  await connectDB()
  const oid = toObjectId(userId)
  const raw = (await CollectionItem.find({ userId: oid }).select("category").lean()) as RawItem[]
  const counts = new Map<string, number>()
  for (const it of raw) {
    const c = String(it.category || "").toLowerCase()
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const topCategories = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)

  const docs = (await Showcase.find({ visibility: "public", userId: { $ne: oid } })
    .sort({ followerCount: -1, updatedAt: -1 })
    .limit(40)
    .lean()) as Record<string, unknown>[]

  // Rank by theme/category overlap, then by follower count.
  const scored = docs
    .map((d) => {
      const theme = String(d.theme || "").toLowerCase()
      const overlap = topCategories.findIndex((c) => c.includes(theme) || theme.includes(c))
      const score = overlap >= 0 ? 100 - overlap : 0
      return { d, score }
    })
    .sort((a, b) => b.score - a.score || Number(b.d.followerCount || 0) - Number(a.d.followerCount || 0))
    .slice(0, limit)

  return Promise.all(scored.map((s) => toSummary(s.d)))
}

/** Compact showcase summary for the profile "Vetrina" section (Blocco 32). */
export interface ShowcaseProfileSummary {
  exists: boolean
  visible: boolean
  title: string
  theme: string
  visibility: ShowcaseVisibility
  followerCount: number
  exposedCount: number
  exposedValue: number
  rareCount: number
  trendPct: number
}

export async function getShowcaseProfileSummary(
  userId: string,
  isOwner: boolean,
): Promise<ShowcaseProfileSummary | null> {
  await connectDB()
  const sc = await Showcase.findOne({ userId: toObjectId(userId) }).lean<Record<string, unknown>>()
  if (!sc) return { exists: false, visible: false, title: "", theme: "", visibility: "disabled", followerCount: 0, exposedCount: 0, exposedValue: 0, rareCount: 0, trendPct: 0 }

  const visibility = (sc.visibility as ShowcaseVisibility) || "disabled"
  // Non-owners only see a public showcase summary.
  const visible = isOwner || visibility === "public"
  const featuredIds = ((sc.featuredItems as unknown[]) || []).map((x) => String(x))
  const a = await computeShowcaseAnalysis(userId, featuredIds)

  return {
    exists: true,
    visible,
    title: String(sc.title || ""),
    theme: String(sc.theme || "Custom"),
    visibility,
    followerCount: Number(sc.followerCount || 0),
    exposedCount: a.exposedCount,
    exposedValue: a.exposedValue,
    rareCount: a.rareCount,
    trendPct: a.trendPct,
  }
}

/**
 * Showcases belonging to fellow members of the viewer's groups. Includes
 * private showcases (visibility === "private" is exposed to groups per spec),
 * but excludes disabled ones and the viewer's own.
 */
export async function getGroupShowcases(userId: string, limit = 12): Promise<ShowcaseSummary[]> {
  await connectDB()
  const oid = toObjectId(userId)
  // Late import to avoid a hard dependency cycle with the groups engine.
  const GroupMember = (await import("@/lib/models/GroupMember")).default

  const myGroups = (await GroupMember.find({ userId: oid }).select("groupId").lean()) as Record<string, unknown>[]
  const groupIds = myGroups.map((m) => m.groupId)
  if (!groupIds.length) return []

  const fellows = (await GroupMember.find({ groupId: { $in: groupIds }, userId: { $ne: oid } })
    .select("userId")
    .lean()) as Record<string, unknown>[]
  const fellowIds = [...new Set(fellows.map((f) => String(f.userId)))]
  if (!fellowIds.length) return []

  const docs = (await Showcase.find({
    userId: { $in: fellowIds.map(toObjectId) },
    visibility: { $in: ["public", "private"] },
  })
    .sort({ followerCount: -1, updatedAt: -1 })
    .limit(limit)
    .lean()) as Record<string, unknown>[]

  return Promise.all(docs.map(toSummary))
}

/**
 * Boosted public showcases ("Vetrine in evidenza", Blocco 33). Resolves the
 * owner userIds with an active showcase boost (rank-ordered) into summaries.
 */
export async function getFeaturedShowcases(limit = 8): Promise<ShowcaseSummary[]> {
  await connectDB()
  const { getActiveBoostTargetIds } = await import("@/lib/boost")
  const ownerIds = await getActiveBoostTargetIds("showcase", limit)
  if (!ownerIds.length) return []

  const docs = (await Showcase.find({
    userId: { $in: ownerIds.map(toObjectId) },
    visibility: "public",
  }).lean()) as Record<string, unknown>[]

  // Preserve the boost rank ordering returned by getActiveBoostTargetIds.
  const order = new Map(ownerIds.map((id, i) => [id, i]))
  docs.sort((a, b) => (order.get(String(a.userId)) ?? 99) - (order.get(String(b.userId)) ?? 99))
  return Promise.all(docs.map(toSummary))
}

/** Resolves a full showcase DTO for the public showcase page. */
export async function getShowcaseByUsername(username: string, viewerId?: string): Promise<ShowcaseDTO | null> {
  await connectDB()
  const user = (await User.findOne({ username }).select("_id username").lean()) as
    | { _id: unknown; username: string }
    | null
  if (!user) return null
  const ownerId = String(user._id)

  const sc = await Showcase.findOne({ userId: user._id }).lean<Record<string, unknown>>()
  if (!sc || sc.visibility === "disabled") return null

  const isOwner = viewerId === ownerId
  // Private showcases are only visible to the owner (group visibility is
  // enforced by the group surfaces, not the public page).
  if (sc.visibility === "private" && !isOwner) return null

  const featuredIds = ((sc.featuredItems as unknown[]) || []).map((x) => String(x))
  const analysis = await computeShowcaseAnalysis(ownerId, featuredIds)

  let isFollowing = false
  if (viewerId && !isOwner) {
    isFollowing = !!(await ShowcaseFollow.exists({ followerId: toObjectId(viewerId), ownerId: user._id }))
  }

  return {
    userId: ownerId,
    username: user.username,
    title: String(sc.title || "Vetrina"),
    description: String(sc.description || ""),
    theme: String(sc.theme || "Custom"),
    visibility: sc.visibility as ShowcaseVisibility,
    followerCount: Number(sc.followerCount || 0),
    isOwner,
    isFollowing,
    analysis,
  }
}
