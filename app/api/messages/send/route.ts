import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import { authMessenger, getOrCreateConversation, appendMessage, isParticipant } from "@/lib/messages"

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
    const recipientId = typeof body.recipientId === "string" ? body.recipientId : ""
    const text = typeof body.text === "string" ? body.text.trim() : ""

    if (!text) {
      return NextResponse.json({ success: false, message: "Il messaggio non può essere vuoto." }, { status: 400 })
    }
    if (text.length > 2000) {
      return NextResponse.json({ success: false, message: "Il messaggio è troppo lungo." }, { status: 400 })
    }
    if (!conversationId && !recipientId) {
      return NextResponse.json({ success: false, message: "Destinatario mancante." }, { status: 400 })
    }

    await connectDB()

    let conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return NextResponse.json({ success: false, message: "Conversazione non trovata." }, { status: 404 })
      }
      if (!isParticipant(conversation, sender.userId)) {
        return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
      }
    } else {
      if (recipientId === sender.userId) {
        return NextResponse.json({ success: false, message: "Non puoi scriverti da solo." }, { status: 400 })
      }
      conversation = await getOrCreateConversation(sender, recipientId)
      if (!conversation) {
        return NextResponse.json({ success: false, message: "Destinatario non trovato." }, { status: 404 })
      }
    }

    await appendMessage(conversation, sender, { type: "text", text })

    return NextResponse.json({
      success: true,
      message: "Messaggio inviato.",
      conversationId: String(conversation._id),
    })
  } catch (error) {
    console.error("[v0] Errore send message:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
