import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import WishlistEntry from "@/lib/models/WishlistEntry"

export const dynamic = "force-dynamic"

interface EntryFilter {
  category?: string
  userId?: string
}

/**
 * Blocco 24 — admin wishlist analytics: total entries, alert adoption, the most
 * wished items and categories, plus a filterable (user / category) entry list.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = 20
    const usernameQ = (url.searchParams.get("username") || "").trim()
    const category = (url.searchParams.get("category") || "").trim()

    const filter: EntryFilter = {}
    if (category) filter.category = category
    if (usernameQ) {
      const u = await User.findOne({ username: new RegExp(`^${usernameQ}$`, "i") }).select("_id").lean()
      filter.userId = u ? String((u as { _id: unknown })._id) : "__none__"
    }

    const [totalEntries, alertsEnabled, topItemsAgg, topCategoriesAgg, entries, totalFiltered] = await Promise.all([
      WishlistEntry.countDocuments({}),
      WishlistEntry.countDocuments({ notifyEnabled: true }),
      WishlistEntry.aggregate([
        { $group: { _id: { $toLower: "$itemName" }, name: { $first: "$itemName" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      WishlistEntry.aggregate([
        { $match: { category: { $nin: [null, ""] } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      WishlistEntry.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WishlistEntry.countDocuments(filter),
    ])

    // Resolve usernames for the listed entries.
    const userIds = [...new Set(entries.map((e) => String((e as { userId: unknown }).userId)))]
    const users = await User.find({ _id: { $in: userIds } }).select("_id username").lean()
    const usernameById = new Map(users.map((u) => [String((u as { _id: unknown })._id), (u as { username: string }).username]))

    const rows = entries.map((entry) => ({
      id: String(entry._id),
      username: usernameById.get(String(entry.userId)) || "—",
      itemName: entry.itemName,
      category: entry.category || "—",
      maxPrice: entry.maxPrice ?? null,
      minCondition: entry.minCondition || "—",
      notifyEnabled: Boolean(entry.notifyEnabled),
      createdAt: entry.createdAt,
    }))

    return NextResponse.json({
      success: true,
      totals: {
        totalEntries,
        alertsEnabled,
        alertRate: totalEntries > 0 ? Math.round((alertsEnabled / totalEntries) * 100) : 0,
        uniqueWishers: await WishlistEntry.distinct("userId").then((a) => a.length),
      },
      topItems: topItemsAgg.map((t: { name: string; count: number }) => ({ name: t.name, count: t.count })),
      topCategories: topCategoriesAgg.map((t: { _id: string; count: number }) => ({ category: t._id, count: t.count })),
      entries: rows,
      pagination: { page, limit, total: totalFiltered, pages: Math.ceil(totalFiltered / limit) },
    })
  } catch (err) {
    console.error("[admin/wishlist]", err)
    return NextResponse.json({ success: false, message: "Errore nel caricamento." }, { status: 500 })
  }
}
