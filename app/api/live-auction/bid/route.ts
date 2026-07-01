import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"
import { LIVE_LIMITS, withinCooldown, serializeLiveAuction } from "@/lib/live-shared"

// POST /api/live-auction/bid — places a live bid (anti-snipe auto-extension).
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    const amount = Number(body.amount)
    if (!id) return NextResponse.json({ success: false, message: "ID asta mancante." }, { status: 400 })
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: "Importo non valido." }, { status: 400 })
    }

    await connectDB()

    const auction = await LiveAuction.findById(id)
    if (!auction) return NextResponse.json({ success: false, message: "Asta non trovata." }, { status: 404 })

    const now = Date.now()
    const ended = auction.status !== "live" || new Date(auction.endAt).getTime() <= now
    if (ended) return NextResponse.json({ success: false, message: "L'asta è terminata." }, { status: 400 })

    if (auction.sellerId === userId) {
      return NextResponse.json({ success: false, message: "Non puoi fare offerte sulla tua asta." }, { status: 400 })
    }

    // Anti-spam: 1 bid per second per user.
    const lastOwn = [...auction.bids].reverse().find((b: { userId: string }) => b.userId === userId)
    if (lastOwn && withinCooldown(lastOwn.createdAt, LIVE_LIMITS.bidCooldownMs)) {
      return NextResponse.json({ success: false, message: "Stai facendo offerte troppo velocemente." }, { status: 429 })
    }

    const minRequired = auction.currentPrice + auction.minIncrement
    if (amount < minRequired) {
      return NextResponse.json(
        { success: false, message: `L'offerta deve essere almeno € ${minRequired}.` },
        { status: 400 },
      )
    }

    const user = await User.findById(userId).select("username blocked").lean<{ username?: string; blocked?: boolean }>()
    if (user?.blocked) return NextResponse.json({ success: false, message: "Account bloccato." }, { status: 403 })
    const username = user?.username || "Utente"

    const previousBidderId = auction.highestBidderId
    auction.bids.push({ userId, username, amount, createdAt: new Date(now) })
    auction.currentPrice = amount
    auction.highestBidderId = userId
    auction.highestBidderUsername = username

    // Anti-sniping: a bid in the final window extends the deadline.
    let extended = false
    const msLeft = new Date(auction.endAt).getTime() - now
    if (auction.autoExtend && msLeft <= auction.extendWindowSeconds * 1000) {
      auction.endAt = new Date(new Date(auction.endAt).getTime() + auction.autoExtendSeconds * 1000)
      auction.extensionsCount += 1
      extended = true
      auction.chat.push({
        userId: "system",
        username: "Sistema",
        message: `Anti-sniping: tempo esteso di +${auction.autoExtendSeconds}s.`,
        system: true,
        createdAt: new Date(now),
      })
    }

    await auction.save()

    // Notify the seller of the new bid.
    void createNotification({
      userId: auction.sellerId,
      type: "auction",
      title: "Nuova offerta sull'asta live",
      body: `${username} ha offerto € ${amount}${extended ? " (tempo esteso)" : ""}.`,
      link: `/live-auction/${auction._id}`,
    })
    // Notify the outbid previous leader.
    if (previousBidderId && previousBidderId !== userId && previousBidderId !== auction.sellerId) {
      void createNotification({
        userId: previousBidderId,
        type: "auction",
        title: "Sei stato superato",
        body: `La tua offerta su "${auction.itemName}" è stata superata.`,
        link: `/live-auction/${auction._id}`,
      })
    }

    return NextResponse.json({ success: true, extended, auction: serializeLiveAuction(auction.toObject(), userId) })
  } catch (error) {
    console.error("[v0] live-auction bid error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
