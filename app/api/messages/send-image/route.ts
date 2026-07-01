import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import { authMessenger, getOrCreateConversation, appendMessage, isParticipant } from "@/lib/messages"

const MAX_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"]

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
    const caption = ((form.get("text") as string) || "").trim()

    if (!file) {
      return NextResponse.json({ success: false, message: "Nessuna immagine fornita." }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, message: "Formato immagine non supportato." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: "Immagine troppo grande (max 8MB)." }, { status: 400 })
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

    await appendMessage(conversation, sender, { type: "image", text: caption, imageUrl: blob.url })

    return NextResponse.json({
      success: true,
      message: "Immagine inviata.",
      conversationId: String(conversation._id),
      url: blob.url,
    })
  } catch (error) {
    console.error("[v0] Errore send-image:", error)
    return NextResponse.json({ success: false, message: "Errore durante l'invio dell'immagine." }, { status: 500 })
  }
}
