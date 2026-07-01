import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import { authMessenger, getOrCreateConversation, appendMessage, isParticipant } from "@/lib/messages"

const MAX_BYTES = 20 * 1024 * 1024 // 20MB

export async function POST(req: NextRequest) {
  try {
    const sender = await authMessenger(req)
    if (!sender) {
      return NextResponse.json({ success: false, message: "Token mancante o non valido." }, { status: 401 })
    }

    const form = await req.formData()
    const file = form.get("file") as File | null
    const conversationId = (form.get("conversationId") as string) || ""
    const recipientId = (form.get("recipientId") as string) || ""

    if (!file) {
      return NextResponse.json({ success: false, message: "Nessun allegato fornito." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: "Allegato troppo grande (max 20MB)." }, { status: 400 })
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

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const blob = await put(`messages/${conversation._id}/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    })

    await appendMessage(conversation, sender, {
      type: "attachment",
      attachment: {
        url: blob.url,
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      },
    })

    return NextResponse.json({
      success: true,
      message: "Allegato inviato.",
      conversationId: String(conversation._id),
      url: blob.url,
    })
  } catch (error) {
    console.error("[v0] Errore send-attachment:", error)
    return NextResponse.json({ success: false, message: "Errore durante l'invio dell'allegato." }, { status: 500 })
  }
}
