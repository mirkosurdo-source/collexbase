import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"
import ChatMessage from "@/lib/models/ChatMessage"
import User from "@/lib/models/User"

export const dynamic = "force-dynamic"

/**
 * Chat moderation views, selected by `?view=`:
 *  - threads   : recent threads with participant usernames + counts
 *  - messages  : a single thread's messages (requires ?threadId=)
 *  - suspended : threads suspended by moderation
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "threads"
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
    const limit = 20
    const skip = (page - 1) * limit

    if (view === "messages") {
      const threadId = url.searchParams.get("threadId")
      if (!threadId) return NextResponse.json({ success: false, message: "threadId mancante." }, { status: 400 })
      const messages = await ChatMessage.find({ threadId }).sort({ createdAt: 1 }).limit(500).lean()
      const senderIds = [...new Set(messages.map((m) => String(m.senderId)))]
      const users = await User.find({ _id: { $in: senderIds } }).select("username").lean()
      const map = new Map(users.map((u) => [String(u._id), u.username]))
      return NextResponse.json({
        success: true,
        messages: messages.map((m) => ({
          id: String(m._id),
          senderId: String(m.senderId),
          senderUsername: m.senderUsername || map.get(String(m.senderId)) || "—",
          text: m.deleted ? null : m.text,
          attachments: m.deleted ? [] : m.attachments || [],
          deleted: Boolean(m.deleted),
          createdAt: m.createdAt,
        })),
      })
    }

    const query = view === "suspended" ? { status: "suspended" } : {}
    const total = await ChatThread.countDocuments(query)
    const threads = await ChatThread.find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    const participantIds = [...new Set(threads.flatMap((t) => (t.participants || []).map((p: unknown) => String(p))))]
    const users = await User.find({ _id: { $in: participantIds } }).select("username").lean()
    const nameMap = new Map(users.map((u) => [String(u._id), u.username]))

    // Per-thread message counts in one aggregation.
    const counts = await ChatMessage.aggregate([
      { $match: { threadId: { $in: threads.map((t) => String(t._id)) } } },
      { $group: { _id: "$threadId", n: { $sum: 1 } } },
    ])
    const countMap = new Map(counts.map((c: { _id: string; n: number }) => [c._id, c.n]))

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      threads: threads.map((t) => ({
        id: String(t._id),
        participants: (t.participants || []).map((p: unknown) => nameMap.get(String(p)) || "—"),
        type: t.type || "private",
        contextId: t.contextId ? String(t.contextId) : null,
        contextLabel: t.contextLabel || "",
        messageCount: countMap.get(String(t._id)) || 0,
        status: t.status || "active",
        reportedBy: (t.reportedBy || []).length,
        reportReason: t.reportReason || "",
        lastMessageAt: t.lastMessageAt || t.updatedAt,
        lastMessageText: t.lastMessageText || "",
      })),
    })
  } catch (err) {
    console.error("[v0] admin/chat error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
