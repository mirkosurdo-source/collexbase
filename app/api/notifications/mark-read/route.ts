import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Notification from "@/lib/models/Notification"
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

    // Accept a single `id` (original behaviour) or an array of `ids` (Blocco 20).
    const id = typeof body.id === "string" ? body.id : ""
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : []
    const targetIds = ids.length > 0 ? ids : id ? [id] : []

    if (targetIds.length === 0) {
      return NextResponse.json({ success: false, message: "ID notifica mancante." }, { status: 400 })
    }

    await connectDB()

    // Scope by userId so a user can only mark their own notifications.
    const result = await Notification.updateMany(
      { _id: { $in: targetIds }, userId: decoded.userId },
      { read: true },
    )

    if (!result.matchedCount) {
      return NextResponse.json({ success: false, message: "Notifica non trovata." }, { status: 404 })
    }

    const unreadCount = await Notification.countDocuments({ userId: decoded.userId, read: false })

    return NextResponse.json({ success: true, message: "Notifiche segnate come lette.", unreadCount })
  } catch (error) {
    console.error("[v0] Errore mark-read notification:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
