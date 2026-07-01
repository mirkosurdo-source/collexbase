import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import { authMessenger, isParticipant } from "@/lib/messages"

/**
 * Records a "typing" ping for the current user in a conversation. Clients call
 * this on a throttle while composing; the thread endpoint reports the other
 * participant as typing if their ping is within the last few seconds.
 */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const sender = await authMessenger(req, body?.token as string | undefined)
    if (!sender) {
      return NextResponse.json({ success: false, message: "Token mancante o non valido." }, { status: 401 })
    }

    const conversationId = typeof body.conversationId === "string" ? body.conversationId : ""
    const isTyping = body.typing !== false
    if (!conversationId) {
      return NextResponse.json({ success: false, message: "Conversazione mancante." }, { status: 400 })
    }

    await connectDB()
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversazione non trovata." }, { status: 404 })
    }
    if (!isParticipant(conversation, sender.userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    conversation.typing.set(sender.userId, isTyping ? Date.now() : 0)
    await conversation.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Errore typing:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
