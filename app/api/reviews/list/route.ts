import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Review from "@/lib/models/Review"
import User from "@/lib/models/User"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username") || ""
    const type = searchParams.get("type") || "all"
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10))
    const perPage = 10

    if (!username) return NextResponse.json({ error: "Username mancante." }, { status: 400 })

    await connectDB()

    const target = await User.findOne({ username }).select("_id username")
    if (!target) return NextResponse.json({ error: "Utente non trovato." }, { status: 404 })

    const query: Record<string, unknown> = { targetUserId: target._id }
    if (type !== "all" && ["seller", "buyer", "trade"].includes(type)) {
      query.type = type
    }

    const total = await Review.countDocuments(query)
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean()

    return NextResponse.json({
      reviews,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    })
  } catch (err) {
    console.error("[v0] review list error:", err)
    return NextResponse.json({ error: "Errore durante il caricamento delle recensioni." }, { status: 500 })
  }
}
