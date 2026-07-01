import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"
import User from "@/lib/models/User"
import { verifyToken } from "@/lib/auth/jwt"
import { createNotification } from "@/lib/notifications"

function extractToken(req: Request, bodyToken?: string): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return bodyToken || null
}

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const token = extractToken(req, body?.token as string | undefined)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    const id = typeof body.id === "string" ? body.id : ""
    if (!id) {
      return NextResponse.json({ success: false, message: "ID asta mancante." }, { status: 400 })
    }

    const amount = Number(body.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: "Importo offerta non valido." }, { status: 400 })
    }

    await connectDB()

    const auction = await Auction.findById(id)
    if (!auction) {
      return NextResponse.json({ success: false, message: "Asta non trovata." }, { status: 404 })
    }

    if (auction.status !== "active" || new Date(auction.endsAt) <= new Date()) {
      return NextResponse.json({ success: false, message: "L'asta è chiusa." }, { status: 400 })
    }

    if (auction.userId === decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Non puoi fare offerte sulla tua asta." },
        { status: 400 },
      )
    }

    const minRequired = auction.currentPrice + auction.minIncrement
    if (amount < minRequired) {
      return NextResponse.json(
        { success: false, message: `L'offerta deve essere almeno € ${minRequired}.` },
        { status: 400 },
      )
    }

    let username = ""
    try {
      const user = await User.findById(decoded.userId).lean()
      username = (user as Record<string, unknown> | null)?.username as string | undefined || ""
    } catch {
      username = ""
    }

    auction.bids.push({ userId: decoded.userId, username, amount, createdAt: new Date() })
    const previousHighestBidderId = auction.highestBidderId
    auction.currentPrice = amount
    auction.highestBidderId = decoded.userId
    await auction.save()

    // Trigger: notify the auction owner that a new bid was received.
    await createNotification({
      userId: auction.userId,
      type: "auction",
      title: "Nuova offerta ricevuta",
      body: `${username || "Un utente"} ha offerto € ${amount} su "${auction.itemName}".`,
      link: `/auctions/${auction._id}`,
    })

    // Trigger: notify the previous highest bidder that they were outbid.
    if (previousHighestBidderId && previousHighestBidderId !== decoded.userId) {
      await createNotification({
        userId: previousHighestBidderId,
        type: "auction",
        title: "Sei stato superato",
        body: `La tua offerta su "${auction.itemName}" è stata superata (€ ${amount}).`,
        link: `/auctions/${auction._id}`,
      })
    }

    return NextResponse.json({ success: true, message: "Offerta registrata.", auction })
  } catch (error) {
    console.error("[v0] Errore bid auction:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
