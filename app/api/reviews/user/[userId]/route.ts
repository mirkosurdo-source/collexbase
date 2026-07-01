import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Types } from "mongoose"
import Review from "@/lib/models/Review"
import User from "@/lib/models/User"

export const dynamic = "force-dynamic"

/**
 * Blocco 28 — all reviews received by a user (by id or username). Paginated.
 * Read-only.
 */
export async function GET(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await ctx.params
    const handle = (userId || "").trim()
    if (!handle) return NextResponse.json({ error: "Utente mancante." }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || "all"
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10))
    const perPage = 10

    await connectDB()

    let targetId: Types.ObjectId
    if (/^[a-f\d]{24}$/i.test(handle)) {
      targetId = new Types.ObjectId(handle)
    } else {
      const user = await User.findOne({ username: handle }).select("_id")
      if (!user) return NextResponse.json({ error: "Utente non trovato." }, { status: 404 })
      targetId = user._id as Types.ObjectId
    }

    const query: Record<string, unknown> = { targetUserId: targetId }
    if (type !== "all" && ["seller", "buyer", "trade"].includes(type)) query.type = type

    const total = await Review.countDocuments(query)
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean()

    return NextResponse.json({
      success: true,
      reviews,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    })
  } catch (err) {
    console.error("[v0] reviews/user error:", err)
    return NextResponse.json({ error: "Errore durante il caricamento delle recensioni." }, { status: 500 })
  }
}
