import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Auction from "@/lib/models/Auction"
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

    await connectDB()

    const auction = await Auction.findById(id)
    if (!auction) {
      return NextResponse.json({ success: false, message: "Asta non trovata." }, { status: 404 })
    }

    if (auction.userId !== decoded.userId) {
      return NextResponse.json(
        { success: false, message: "Solo il creatore può chiudere l'asta." },
        { status: 403 },
      )
    }

    auction.status = "closed"
    await auction.save()

    // Trigger: notify the owner that their auction has ended.
    await createNotification({
      userId: auction.userId,
      type: "auction",
      title: "Asta terminata",
      body: auction.highestBidderId
        ? `La tua asta "${auction.itemName}" si è conclusa a € ${auction.currentPrice}.`
        : `La tua asta "${auction.itemName}" si è conclusa senza offerte.`,
      link: `/auctions/${auction._id}`,
    })

    // Trigger: notify the winning bidder, if any.
    if (auction.highestBidderId && auction.highestBidderId !== auction.userId) {
      await createNotification({
        userId: auction.highestBidderId,
        type: "auction",
        title: "Hai vinto l'asta!",
        body: `Ti sei aggiudicato "${auction.itemName}" per € ${auction.currentPrice}.`,
        link: `/auctions/${auction._id}`,
      })
    }

    return NextResponse.json({ success: true, message: "Asta chiusa.", auction })
  } catch (error) {
    console.error("[v0] Errore close auction:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
