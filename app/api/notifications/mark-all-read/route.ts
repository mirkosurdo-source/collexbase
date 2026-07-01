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

    await connectDB()

    await Notification.updateMany({ userId: decoded.userId, read: false }, { read: true })

    return NextResponse.json({ success: true, message: "Tutte le notifiche segnate come lette.", unreadCount: 0 })
  } catch (error) {
    console.error("[v0] Errore mark-all-read notifications:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
