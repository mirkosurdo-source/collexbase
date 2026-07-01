import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Trade from "@/lib/models/Trade"
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
    const text = typeof body.text === "string" ? body.text.trim() : ""

    if (!id) {
      return NextResponse.json({ success: false, message: "ID scambio mancante." }, { status: 400 })
    }

    if (!text) {
      return NextResponse.json({ success: false, message: "Il messaggio non può essere vuoto." }, { status: 400 })
    }

    if (text.length > 1000) {
      return NextResponse.json({ success: false, message: "Il messaggio è troppo lungo." }, { status: 400 })
    }

    await connectDB()

    const trade = await Trade.findById(id)
    if (!trade) {
      return NextResponse.json({ success: false, message: "Scambio non trovato." }, { status: 404 })
    }

    // Only participants can chat.
    if (trade.toUserId !== decoded.userId && trade.fromUserId !== decoded.userId) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    let senderUsername = ""
    try {
      const user = await User.findById(decoded.userId).lean()
      senderUsername = ((user as Record<string, unknown> | null)?.username as string) || ""
    } catch {
      senderUsername = ""
    }

    trade.messages.push({
      senderId: decoded.userId,
      senderUsername,
      text,
      createdAt: new Date(),
    })
    await trade.save()

    // Trigger: notify the other participant about the new chat message.
    const otherUserId = trade.fromUserId === decoded.userId ? trade.toUserId : trade.fromUserId
    await createNotification({
      userId: otherUserId,
      type: "message",
      title: "Nuovo messaggio",
      body: `${senderUsername || "Un utente"}: ${text.length > 80 ? `${text.slice(0, 80)}...` : text}`,
      link: `/trades/${trade._id}`,
    })

    return NextResponse.json({ success: true, message: "Messaggio inviato.", trade })
  } catch (error) {
    console.error("[v0] Errore message trade:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
