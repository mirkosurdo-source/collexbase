import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { LIVE_LIMITS, startOfToday, serializeLiveAuction } from "@/lib/live-shared"

const ALLOWED_EXTENDS = [10, 15, 30]

// POST /api/live-auction/create — opens a new live auction (limit 3/day).
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const itemName = typeof body.itemName === "string" ? body.itemName.trim() : ""
    if (!itemName) return NextResponse.json({ success: false, message: "Nome oggetto mancante." }, { status: 400 })

    const startPrice = Number(body.startPrice)
    if (!Number.isFinite(startPrice) || startPrice < 0) {
      return NextResponse.json({ success: false, message: "Prezzo iniziale non valido." }, { status: 400 })
    }

    const minIncrement = Number(body.minIncrement)
    const durationMinutes = Number(body.durationMinutes)
    const safeDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.min(durationMinutes, 240) : 5
    const autoExtend = body.autoExtend !== false
    const requestedExtend = Number(body.autoExtendSeconds)
    const autoExtendSeconds = ALLOWED_EXTENDS.includes(requestedExtend) ? requestedExtend : 10

    await connectDB()

    // Anti-abuse: max live auctions per day.
    const todayCount = await LiveAuction.countDocuments({ sellerId: userId, createdAt: { $gte: startOfToday() } })
    if (todayCount >= LIVE_LIMITS.maxLiveAuctionsPerDay) {
      return NextResponse.json(
        { success: false, message: `Hai raggiunto il limite di ${LIVE_LIMITS.maxLiveAuctionsPerDay} aste live al giorno.` },
        { status: 429 },
      )
    }

    const user = await User.findById(userId).select("username blocked").lean<{ username?: string; blocked?: boolean }>()
    if (user?.blocked) {
      return NextResponse.json({ success: false, message: "Account bloccato." }, { status: 403 })
    }

    const now = Date.now()
    const auction = await LiveAuction.create({
      sellerId: userId,
      sellerUsername: user?.username || "",
      itemId: typeof body.itemId === "string" ? body.itemId : "",
      itemName,
      description: typeof body.description === "string" ? body.description.trim() : "",
      image: typeof body.image === "string" ? body.image.trim() : "",
      startPrice,
      currentPrice: startPrice,
      minIncrement: Number.isFinite(minIncrement) && minIncrement > 0 ? minIncrement : 1,
      status: "live",
      startAt: new Date(now),
      endAt: new Date(now + safeDuration * 60 * 1000),
      autoExtend,
      autoExtendSeconds,
    })

    return NextResponse.json({ success: true, auction: serializeLiveAuction(auction.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-auction create error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
