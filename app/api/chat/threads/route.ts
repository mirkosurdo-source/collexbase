import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"
import ChatMessage from "@/lib/models/ChatMessage"
import User from "@/lib/models/User"
import { serializeThread } from "@/lib/chat"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    await connectDB()

    const url = new URL(req.url)
    const since = url.searchParams.get("since")

    const query: Record<string, unknown> = { participants: userId }
    if (since) {
      const sinceDate = new Date(since)
      if (!Number.isNaN(sinceDate.getTime())) {
        query.updatedAt = { $gt: sinceDate }
      }
    }

    const threads = await ChatThread.find(query).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(100).lean()

    // Resolve other participants' public profiles in one query.
    const otherIds = new Set<string>()
    for (const t of threads as { participants: string[] }[]) {
      const other = t.participants.find((p) => p !== userId)
      if (other) otherIds.add(other)
    }
    const users = await User.find({ _id: { $in: Array.from(otherIds) } })
      .select("username avatar")
      .lean<{ _id: unknown; username: string; avatar?: string }[]>()
    const userMap = new Map(users.map((u) => [String(u._id), u]))

    // Unread counts per thread for this viewer.
    const threadIds = (threads as { _id: unknown }[]).map((t) => String(t._id))
    const unreadAgg = await ChatMessage.aggregate([
      { $match: { threadId: { $in: threadIds }, senderId: { $ne: userId }, readBy: { $ne: userId }, deleted: { $ne: true } } },
      { $group: { _id: "$threadId", count: { $sum: 1 } } },
    ])
    const unreadMap = new Map(unreadAgg.map((r: { _id: string; count: number }) => [String(r._id), r.count]))

    const result = (threads as Record<string, unknown>[]).map((t) => {
      const base = serializeThread(t, userId)
      const otherId = (t.participants as string[]).find((p) => p !== userId)
      const other = otherId ? userMap.get(otherId) : null
      return {
        ...base,
        unreadCount: unreadMap.get(String(t._id)) || 0,
        otherUser: other ? { id: otherId, username: other.username, avatar: other.avatar || "" } : null,
      }
    })

    return NextResponse.json({ success: true, threads: result, serverTime: new Date().toISOString() })
  } catch (error) {
    console.error("[v0] chat/threads error:", error)
    return NextResponse.json({ success: false, message: "Errore durante il recupero delle chat." }, { status: 500 })
  }
}
