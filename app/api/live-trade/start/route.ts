import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveTrade from "@/lib/models/LiveTrade"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"
import { LIVE_LIMITS, startOfToday, serializeLiveTrade } from "@/lib/live-shared"

// POST /api/live-trade/start — opens a live trade session with another user.
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const toUserId = typeof body.toUserId === "string" ? body.toUserId.trim() : ""
    const toUsername = typeof body.toUsername === "string" ? body.toUsername.trim() : ""
    if (!toUserId && !toUsername) {
      return NextResponse.json({ success: false, message: "Destinatario mancante." }, { status: 400 })
    }

    await connectDB()

    const me = await User.findById(userId).select("username blocked").lean<{ username?: string; blocked?: boolean }>()
    if (me?.blocked) return NextResponse.json({ success: false, message: "Account bloccato." }, { status: 403 })

    // Resolve the counterparty by id or username.
    const other = toUserId
      ? await User.findById(toUserId).select("username blocked").lean<{ _id: unknown; username?: string; blocked?: boolean }>()
      : await User.findOne({ username: toUsername }).select("username blocked").lean<{ _id: unknown; username?: string; blocked?: boolean }>()
    if (!other) return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })

    const otherId = String(other._id)
    if (otherId === userId) {
      return NextResponse.json({ success: false, message: "Non puoi scambiare con te stesso." }, { status: 400 })
    }
    if (other.blocked) return NextResponse.json({ success: false, message: "Questo utente non è disponibile." }, { status: 403 })

    // Anti-abuse: max live trades per day (as initiator).
    const todayCount = await LiveTrade.countDocuments({ userA: userId, createdAt: { $gte: startOfToday() } })
    if (todayCount >= LIVE_LIMITS.maxLiveTradesPerDay) {
      return NextResponse.json(
        { success: false, message: `Hai raggiunto il limite di ${LIVE_LIMITS.maxLiveTradesPerDay} scambi live al giorno.` },
        { status: 429 },
      )
    }

    // Reuse an existing open session between the same pair, if any.
    const existing = await LiveTrade.findOne({
      status: "live",
      $or: [
        { userA: userId, userB: otherId },
        { userA: otherId, userB: userId },
      ],
    })
    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
      return NextResponse.json({ success: true, trade: serializeLiveTrade(existing.toObject(), userId) })
    }

    const now = Date.now()
    const trade = await LiveTrade.create({
      userA: userId,
      userAUsername: me?.username || "",
      userB: otherId,
      userBUsername: other.username || "",
      status: "live",
      timerSeconds: LIVE_LIMITS.tradeTimerSeconds,
      expiresAt: new Date(now + LIVE_LIMITS.tradeTimerSeconds * 1000),
      chat: [
        {
          userId: "system",
          username: "Sistema",
          message: "Scambio live avviato. Avete 5 minuti per concludere.",
          system: true,
          createdAt: new Date(now),
        },
      ],
    })

    void createNotification({
      userId: otherId,
      type: "trade",
      title: "Nuovo scambio live",
      body: `${me?.username || "Un utente"} ti ha invitato a uno scambio live.`,
      link: `/trade/live/${trade._id}`,
    })

    return NextResponse.json({ success: true, trade: serializeLiveTrade(trade.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-trade start error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
