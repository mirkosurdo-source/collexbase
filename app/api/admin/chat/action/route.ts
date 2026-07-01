import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"
import ChatMessage from "@/lib/models/ChatMessage"

export const dynamic = "force-dynamic"

/**
 * Moderation actions:
 *  - suspend_thread / reactivate_thread : toggle thread.status
 *  - delete_message                     : soft-delete a message
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    await connectDB()
    const body = await req.json().catch(() => ({}))
    const { action, threadId, messageId } = body as {
      action?: string
      threadId?: string
      messageId?: string
    }

    if (action === "suspend_thread" || action === "reactivate_thread") {
      if (!threadId) return NextResponse.json({ success: false, message: "threadId mancante." }, { status: 400 })
      const status = action === "suspend_thread" ? "suspended" : "active"
      const thread = await ChatThread.findByIdAndUpdate(threadId, { status }, { new: true })
      if (!thread) return NextResponse.json({ success: false, message: "Conversazione non trovata." }, { status: 404 })
      return NextResponse.json({ success: true, status })
    }

    if (action === "delete_message") {
      if (!messageId) return NextResponse.json({ success: false, message: "messageId mancante." }, { status: 400 })
      const msg = await ChatMessage.findByIdAndUpdate(
        messageId,
        { deleted: true, deletedBy: auth.admin?.userId || "admin", text: null, attachments: [] },
        { new: true },
      )
      if (!msg) return NextResponse.json({ success: false, message: "Messaggio non trovato." }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, message: "Azione non valida." }, { status: 400 })
  } catch (err) {
    console.error("[v0] admin/chat/action error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
