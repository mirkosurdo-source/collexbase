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

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id") || ""
    if (!id) {
      return NextResponse.json({ success: false, message: "ID conversazione mancante." }, { status: 400 })
    }

    await connectDB()

    const conversation = await Conversation.findById(id).lean()
    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversazione non trovata." }, { status: 404 })
    }

    const conv = conversation as Record<string, unknown>
    const participants = (conv.participants as string[]) || []

    // Only participants can read the thread.
    if (!participants.includes(decoded.userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    const participantInfo = (conv.participantInfo as Record<string, unknown>[]) || []
    const other = participantInfo.find((p) => p.userId !== decoded.userId) || {}
    const otherId = (other.userId as string) || ""

    // Seller badge for the counterparty.
    let isSeller = false
    try {
      const count = await Listing.countDocuments({ sellerId: otherId, status: "active" })
      isSeller = count > 0
    } catch {
      isSeller = false
    }

    // Typing: other participant pinged within the last 6 seconds.
    const typingMap = (conv.typing as Record<string, number>) || {}
    const otherTyping = Date.now() - Number(typingMap[otherId] || 0) < 6000

    const messages = ((conv.messages as Record<string, unknown>[]) || []).map((m) => {
      const offer = m.offer as Record<string, unknown> | undefined
      const attachment = m.attachment as Record<string, unknown> | undefined
      const readBy = (m.readBy as string[]) || []
      return {
        _id: String(m._id),
        senderId: (m.senderId as string) || "",
        senderUsername: (m.senderUsername as string) || "",
        type: (m.type as string) || "text",
        text: (m.text as string) || "",
        imageUrl: (m.imageUrl as string) || "",
        attachment: attachment
          ? {
              url: (attachment.url as string) || "",
              name: (attachment.name as string) || "",
              size: Number(attachment.size) || 0,
              contentType: (attachment.contentType as string) || "",
            }
          : null,
        offer: offer ? { ...offer, _id: String(m._id) } : null,
        createdAt: m.createdAt,
        mine: (m.senderId as string) === decoded.userId,
        readByOther: otherId ? readBy.includes(otherId) : false,
      }
    })

    return NextResponse.json({
      success: true,
      conversation: {
        _id: String(conv._id),
        otherUserId: otherId,
        otherUsername: (other.username as string) || "Utente",
        otherAvatar: (other.avatar as string) || "",
        isSeller,
        otherTyping,
        activeNegotiation: Boolean(conv.activeNegotiation),
      },
      messages,
    })
  } catch (error) {
    console.error("[v0] Errore thread:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
