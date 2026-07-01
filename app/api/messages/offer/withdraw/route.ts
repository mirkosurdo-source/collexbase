import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import { authMessenger, isParticipant, setOfferStatus } from "@/lib/messages"

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
    const messageId = typeof body.messageId === "string" ? body.messageId : ""
    if (!conversationId || !messageId) {
      return NextResponse.json({ success: false, message: "Riferimenti mancanti." }, { status: 400 })
    }

    await connectDB()
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversazione non trovata." }, { status: 404 })
    }
    if (!isParticipant(conversation, sender.userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    const result = await setOfferStatus(conversation, messageId, "withdrawn", sender)
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error }, { status: result.status || 400 })
    }

    return NextResponse.json({ success: true, message: "Offerta ritirata." })
  } catch (error) {
    console.error("[v0] Errore offer/withdraw:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
