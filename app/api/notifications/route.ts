import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Notification from "@/lib/models/Notification"
import { verifyToken } from "@/lib/auth/jwt"

export const dynamic = "force-dynamic"

const VALID_TYPES = ["auction", "trade", "message", "system", "chat", "marketplace", "payment", "escrow", "moderation"]

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) return authHeader.slice(7)
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(n: any) {
  return {
    _id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body || "",
    link: n.link || "",
    context: n.context || null,
    read: !!n.read,
    isRead: !!n.read,
    createdAt: n.createdAt,
  }
}

/**
 * Unified notifications feed for the logged-in user.
 * Supports `?since=<ISO|ms>` for incremental polling (Blocco 19 pattern),
 * plus optional `?type=` and `?limit=`.
 */
export async function GET(req: Request) {
  try {
    const token = extractToken(req)
    if (!token) return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || ""
    const since = searchParams.get("since") || ""
    const limitParam = Number(searchParams.get("limit"))
    const limit = Number.isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 100)

    await connectDB()

    const filter: Record<string, unknown> = { userId: decoded.userId, deleted: { $ne: true } }
    if (type && VALID_TYPES.includes(type)) filter.type = type

    if (since) {
      const sinceDate = new Date(/^\d+$/.test(since) ? Number(since) : since)
      if (!Number.isNaN(sinceDate.getTime())) {
        filter.createdAt = { $gt: sinceDate }
      }
    }

    const docs = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    const unreadCount = await Notification.countDocuments({
      userId: decoded.userId,
      deleted: { $ne: true },
      read: false,
    })

    return NextResponse.json({
      success: true,
      notifications: docs.map(serialize),
      unreadCount,
      serverTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] GET notifications error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
