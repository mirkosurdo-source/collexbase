import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Showcase from "@/lib/models/Showcase"
import ShowcaseFollow from "@/lib/models/ShowcaseFollow"

export const dynamic = "force-dynamic"

/** Admin showcase moderation: search, filter by theme/visibility, paginate. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const theme = url.searchParams.get("theme") || ""
    const visibility = url.searchParams.get("visibility") || ""
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))

    const filter: Record<string, unknown> = {}
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { username: { $regex: q, $options: "i" } },
        { theme: { $regex: q, $options: "i" } },
      ]
    }
    if (theme) filter.theme = theme
    if (["public", "private", "disabled"].includes(visibility)) filter.visibility = visibility

    const [total, docs, totals, themeAgg] = await Promise.all([
      Showcase.countDocuments(filter),
      Showcase.find(filter)
        .select("username title theme visibility followerCount viewCount featuredItems createdAt")
        .sort({ followerCount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Showcase.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            followers: { $sum: "$followerCount" },
            views: { $sum: "$viewCount" },
            publicCount: { $sum: { $cond: [{ $eq: ["$visibility", "public"] }, 1, 0] } },
          },
        },
      ]),
      Showcase.aggregate([{ $group: { _id: "$theme", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ])

    const rows = (docs as Record<string, unknown>[]).map((s) => ({
      id: String(s._id),
      userId: String(s.userId),
      username: s.username || "—",
      title: s.title || "Vetrina",
      theme: s.theme || "Custom",
      visibility: s.visibility || "disabled",
      followerCount: Number(s.followerCount || 0),
      viewCount: Number(s.viewCount || 0),
      itemCount: ((s.featuredItems as unknown[]) || []).length,
      createdAt: s.createdAt,
    }))

    return NextResponse.json({
      success: true,
      showcases: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        total: totals[0]?.total ?? 0,
        followers: totals[0]?.followers ?? 0,
        views: totals[0]?.views ?? 0,
        publicCount: totals[0]?.publicCount ?? 0,
        topTheme: themeAgg[0]?._id ?? "—",
      },
    })
  } catch (err) {
    console.error("[v0] admin/showcase GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** Moderate a showcase: force its visibility (e.g. disable an abusive one). */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || "")
    const visibility = String(body.visibility || "")
    if (!id || !["public", "private", "disabled"].includes(visibility)) {
      return NextResponse.json({ success: false, message: "Parametri non validi." }, { status: 400 })
    }
    const res = await Showcase.updateOne({ _id: id }, { $set: { visibility } })
    if (!res.matchedCount) return NextResponse.json({ success: false, message: "Vetrina non trovata." }, { status: 404 })
    return NextResponse.json({ success: true, message: "Vetrina aggiornata." })
  } catch (err) {
    console.error("[v0] admin/showcase PATCH error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** Delete a showcase and its follow relationships. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })

    const sc = await Showcase.findById(id).select("userId").lean<{ userId?: unknown } | null>()
    if (!sc) return NextResponse.json({ success: false, message: "Vetrina non trovata." }, { status: 404 })

    await Promise.all([
      Showcase.deleteOne({ _id: id }),
      ShowcaseFollow.deleteMany({ ownerId: sc.userId }),
    ])

    return NextResponse.json({ success: true, message: "Vetrina eliminata." })
  } catch (err) {
    console.error("[v0] admin/showcase DELETE error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
