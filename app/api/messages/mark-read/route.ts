import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import { verifyToken } from "@/lib/auth/jwt"

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
      return NextResponse.json({ success: false, message: "ID conversazione mancante." }, { status: 400 })
    }

    await connectDB()

    const conversation = await Conversation.findById(id)
    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversazione non trovata." }, { status: 404 })
    }
    if (!conversation.participants.includes(decoded.userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    // Reset this user's unread counter and mark messages as read by them.
    conversation.unread.set(decoded.userId, 0)
    conversation.messages.forEach((m: Record<string, unknown>) => {
      const readBy = (m.readBy as string[]) || []
      if (!readBy.includes(decoded.userId)) {
        readBy.push(decoded.userId)
        m.readBy = readBy
      }
    })

    await conversation.save()

    return NextResponse.json({ success: true, message: "Conversazione segnata come letta." })
  } catch (error) {
    console.error("[v0] Errore mark-read messages:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
