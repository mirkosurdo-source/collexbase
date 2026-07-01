import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"
import ChatMessage from "@/lib/models/ChatMessage"
import User from "@/lib/models/User"
import { isBlockedBetween, serializeMessage, serializeThread } from "@/lib/chat"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const thread = await ChatThread.findById(id)
    if (!thread) {
      return NextResponse.json({ success: false, message: "Thread non trovato." }, { status: 404 })
    }
    if (!thread.participants.includes(userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    const url = new URL(req.url)
    const since = url.searchParams.get("since")

    const query: Record<string, unknown> = { threadId: id }
    if (since) {
      const sinceDate = new Date(since)
      if (!Number.isNaN(sinceDate.getTime())) {
        query.createdAt = { $gt: sinceDate }
      }
    }

    const messages = await ChatMessage.find(query).sort({ createdAt: 1 }).limit(200).lean()

    // Resolve the other participant's public profile.
    const otherId = thread.participants.find((p: string) => p !== userId)
    const other = otherId
      ? await User.findById(otherId).select("username avatar").lean<{ username: string; avatar?: string }>()
      : null

    const blocked = otherId ? await isBlockedBetween(userId, otherId) : false

    return NextResponse.json({
      success: true,
      thread: serializeThread(thread, userId),
      otherUser: other ? { id: otherId, username: other.username, avatar: other.avatar || "" } : null,
      blocked,
      messages: messages.map(serializeMessage),
      serverTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] chat/thread/[id] error:", error)
    return NextResponse.json({ success: false, message: "Errore durante il recupero del thread." }, { status: 500 })
  }
}
