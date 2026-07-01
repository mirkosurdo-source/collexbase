import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"
import ChatMessage from "@/lib/models/ChatMessage"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const threadId = body.threadId ? String(body.threadId) : ""
    if (!threadId) {
      return NextResponse.json({ success: false, message: "threadId richiesto." }, { status: 400 })
    }

    await connectDB()
    const thread = await ChatThread.findById(threadId).select("participants").lean<{ participants: string[] }>()
    if (!thread || !thread.participants.includes(userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    // Mark every message in the thread not yet read by this user as read.
    const result = await ChatMessage.updateMany(
      { threadId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } },
    )

    return NextResponse.json({ success: true, updated: result.modifiedCount ?? 0 })
  } catch (error) {
    console.error("[v0] chat/read error:", error)
    return NextResponse.json({ success: false, message: "Errore durante l'aggiornamento dello stato di lettura." }, { status: 500 })
  }
}
