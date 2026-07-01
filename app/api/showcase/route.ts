import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import Showcase from "@/lib/models/Showcase"
import CollectionItem from "@/lib/models/Collection"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { computeShowcaseAnalysis, SHOWCASE_THEMES, MAX_FEATURED_ITEMS, type ShowcaseVisibility } from "@/lib/showcase"
import { normalizeItem, type RawItem } from "@/lib/collection-helpers"

function oid(id: string) {
  try {
    return new Types.ObjectId(id)
  } catch {
    return id
  }
}

/** GET /api/showcase — the authenticated user's own showcase + editor data. */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 })
    await connectDB()

    const sc = await Showcase.findOne({ userId: oid(userId) }).lean<Record<string, unknown>>()
    const featuredIds = sc ? ((sc.featuredItems as unknown[]) || []).map((x) => String(x)) : []
    const analysis = await computeShowcaseAnalysis(userId, featuredIds)

    // Full list of the user's items so the editor can pick what to feature.
    const raw = (await CollectionItem.find({ userId: oid(userId) }).sort({ createdAt: -1 }).lean()) as RawItem[]
    const items = raw.map(normalizeItem).map((i) => ({
      id: i.id,
      name: i.name,
      image: i.image,
      category: i.category,
      rarity: i.rarity,
      currentValue: i.currentValue,
    }))

    return NextResponse.json({
      success: true,
      themes: SHOWCASE_THEMES,
      maxFeatured: MAX_FEATURED_ITEMS,
      showcase: {
        title: sc?.title || "",
        description: sc?.description || "",
        theme: sc?.theme || "Custom",
        visibility: (sc?.visibility as ShowcaseVisibility) || "disabled",
        featuredItems: featuredIds,
        followerCount: Number(sc?.followerCount || 0),
      },
      analysis,
      items,
    })
  } catch (error) {
    console.error("[v0] GET /api/showcase error:", error)
    return NextResponse.json({ success: false, error: "Errore del server" }, { status: 500 })
  }
}

/** PUT /api/showcase — create or update the authenticated user's showcase. */
export async function PUT(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 })
    await connectDB()

    const body = await req.json().catch(() => ({}))
    const update: Record<string, unknown> = {}

    if (typeof body.title === "string") update.title = body.title.slice(0, 80).trim()
    if (typeof body.description === "string") update.description = body.description.slice(0, 600).trim()
    if (typeof body.theme === "string" && (SHOWCASE_THEMES as readonly string[]).includes(body.theme)) {
      update.theme = body.theme
    }
    if (["public", "private", "disabled"].includes(body.visibility)) update.visibility = body.visibility

    // Validate featured items belong to the user and cap to MAX_FEATURED_ITEMS.
    if (Array.isArray(body.featuredItems)) {
      const ids = body.featuredItems.map((x: unknown) => String(x)).slice(0, MAX_FEATURED_ITEMS)
      const owned = await CollectionItem.find({ userId: oid(userId), _id: { $in: ids.map(oid) } })
        .select("_id")
        .lean()
      const ownedSet = new Set(owned.map((o: Record<string, unknown>) => String(o._id)))
      // Preserve the submitted order, keep only owned ids.
      update.featuredItems = ids.filter((id: string) => ownedSet.has(id)).map(oid)
    }

    // Keep the denormalized username in sync.
    const user = (await User.findById(userId).select("username").lean()) as { username?: string } | null
    if (user?.username) update.username = user.username

    const sc = await Showcase.findOneAndUpdate({ userId: oid(userId) }, { $set: update }, { upsert: true, new: true }).lean<
      Record<string, unknown>
    >()

    return NextResponse.json({
      success: true,
      showcase: {
        title: sc?.title || "",
        description: sc?.description || "",
        theme: sc?.theme || "Custom",
        visibility: sc?.visibility || "disabled",
        featuredItems: ((sc?.featuredItems as unknown[]) || []).map((x) => String(x)),
      },
    })
  } catch (error) {
    console.error("[v0] PUT /api/showcase error:", error)
    return NextResponse.json({ success: false, error: "Errore del server" }, { status: 500 })
  }
}
