import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Notification from "@/lib/models/Notification"
import { verifyToken } from "@/lib/auth/jwt"

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

export async function GET(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) {
      return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || ""
    const limitParam = Number(searchParams.get("limit"))
    const limit = Number.isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 100)

    await connectDB()

    const filter: Record<string, unknown> = { userId: decoded.userId }
    if (type && ["auction", "trade", "message", "system"].includes(type)) {
      filter.type = type
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    const unreadCount = await Notification.countDocuments({ userId: decoded.userId, read: false })

    return NextResponse.json({ success: true, notifications, unreadCount })
  } catch (error) {
    console.error("[v0] Errore list notifications:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
