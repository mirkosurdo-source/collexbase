import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import Review from "@/lib/models/Review"
import { computeReputation } from "@/lib/reputation"

export const dynamic = "force-dynamic"

/** Admin review moderation: search, filter by rating/type, paginate. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const q = (url.searchParams.get("q") || "").trim()
    const type = url.searchParams.get("type") || ""
    const rating = Number(url.searchParams.get("rating")) || 0
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20))

    const filter: Record<string, unknown> = {}
    if (q) {
      filter.$or = [
        { authorUsername: { $regex: q, $options: "i" } },
        { targetUsername: { $regex: q, $options: "i" } },
        { comment: { $regex: q, $options: "i" } },
      ]
    }
    if (type === "seller" || type === "buyer" || type === "trade") filter.type = type
    if (rating >= 1 && rating <= 5) filter.rating = rating

    const [total, reviews, avgAgg, typeAgg] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .select("authorUsername targetUsername type rating comment refId createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" }, total: { $sum: 1 } } }]),
      Review.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    ])

    const byType: Record<string, number> = { seller: 0, buyer: 0, trade: 0 }
    for (const t of typeAgg) byType[String(t._id)] = t.count

    const rows = reviews.map((r) => ({
      id: String(r._id),
      author: r.authorUsername || "—",
      target: r.targetUsername || "—",
      type: r.type,
      rating: r.rating,
      comment: r.comment || "",
      createdAt: r.createdAt,
    }))

    return NextResponse.json({
      success: true,
      reviews: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: { avg: Math.round((avgAgg[0]?.avg ?? 0) * 10) / 10, total: avgAgg[0]?.total ?? 0, byType },
    })
  } catch (err) {
    console.error("[v0] admin/reviews GET error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** Delete a review (moderation) and recompute the target's reputation. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })

    const review = await Review.findById(id).select("targetUserId").lean<{ targetUserId?: unknown } | null>()
    if (!review) return NextResponse.json({ success: false, message: "Recensione non trovata." }, { status: 404 })

    await Review.deleteOne({ _id: id })

    // Recompute the affected user's reputation after removal.
    if (review.targetUserId) {
      try {
        await computeReputation(String(review.targetUserId))
      } catch {
        // non-critical
      }
    }

    return NextResponse.json({ success: true, message: "Recensione eliminata." })
  } catch (err) {
    console.error("[v0] admin/reviews DELETE error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
