import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Trade from "@/lib/models/Trade"
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
      return NextResponse.json({ success: false, message: "ID scambio mancante." }, { status: 400 })
    }

    await connectDB()

    const trade = await Trade.findById(id)
    if (!trade) {
      return NextResponse.json({ success: false, message: "Scambio non trovato." }, { status: 404 })
    }

    // Both participants can reject/cancel, but only while pending.
    if (trade.toUserId !== decoded.userId && trade.fromUserId !== decoded.userId) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    if (trade.status !== "pending") {
      return NextResponse.json({ success: false, message: "Lo scambio non è più in attesa." }, { status: 400 })
    }

    trade.status = "rejected"
    await trade.save()

    // Trigger: notify the other participant that the trade was rejected/cancelled.
    const otherUserId = trade.fromUserId === decoded.userId ? trade.toUserId : trade.fromUserId
    await createNotification({
      userId: otherUserId,
      type: "trade",
      title: "Scambio rifiutato",
      body: `Lo scambio "${trade.offeredItemName}" ↔ "${trade.requestedItemName}" è stato rifiutato.`,
      link: `/trades/${trade._id}`,
    })

    return NextResponse.json({ success: true, message: "Scambio rifiutato.", trade })
  } catch (error) {
    console.error("[v0] Errore reject trade:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
