import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import Listing from "@/lib/models/Listing"
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

    await connectDB()

    const conversations = await Conversation.find({ participants: decoded.userId })
      .sort({ lastMessageAt: -1 })
      .lean()

    // Determine which counterparties are active sellers (have ≥1 active listing).
    const otherIds = new Set<string>()
    for (const c of conversations as Record<string, unknown>[]) {
      const info = (c.participantInfo as Record<string, unknown>[]) || []
      const other = info.find((p) => p.userId !== decoded.userId)
      if (other?.userId) otherIds.add(other.userId as string)
    }

    let sellerIds = new Set<string>()
    try {
      const sellers = await Listing.find({
        sellerId: { $in: Array.from(otherIds) },
        status: "active",
      })
        .distinct("sellerId")
        .lean()
      sellerIds = new Set((sellers as string[]).map(String))
    } catch {
      sellerIds = new Set()
    }

    let totalUnread = 0

    const list = (conversations as Record<string, unknown>[]).map((c) => {
      const participantInfo = (c.participantInfo as Record<string, unknown>[]) || []
      const other = participantInfo.find((p) => p.userId !== decoded.userId) || {}
      const otherId = (other.userId as string) || ""
      const unreadMap = (c.unread as Record<string, number>) || {}
      const unread = Number(unreadMap[decoded.userId] || 0)
      totalUnread += unread

      // Typing state: other participant pinged within the last 6 seconds.
      const typingMap = (c.typing as Record<string, number>) || {}
      const otherTypingAt = Number(typingMap[otherId] || 0)
      const otherTyping = Date.now() - otherTypingAt < 6000

      return {
        _id: String(c._id),
        otherUserId: otherId,
        otherUsername: (other.username as string) || "Utente",
        otherAvatar: (other.avatar as string) || "",
        isSeller: sellerIds.has(otherId),
        lastMessage: (c.lastMessage as string) || "",
        lastSenderId: (c.lastSenderId as string) || "",
        lastMessageAt: c.lastMessageAt,
        unread,
        activeNegotiation: Boolean(c.activeNegotiation),
        otherTyping,
      }
    })

    return NextResponse.json({ success: true, conversations: list, totalUnread })
  } catch (error) {
    console.error("[v0] Errore conversations:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
