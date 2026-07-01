import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import { authMessenger, getOrCreateConversation, appendMessage, isParticipant, buildOffer } from "@/lib/messages"
import type { OfferItem } from "@/lib/messages"

const VALID_TYPES = ["cash", "item_cash", "item_coins", "multi_trade"]

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
    const offerType = String(body.offerType || "")

    if (!VALID_TYPES.includes(offerType)) {
      return NextResponse.json({ success: false, message: "Tipo di offerta non valido." }, { status: 400 })
    }
    if (!conversationId && !recipientId) {
      return NextResponse.json({ success: false, message: "Destinatario mancante." }, { status: 400 })
    }

    const amount = Number(body.amount) || 0
    const coins = Number(body.coins) || 0
    const offeredItems = Array.isArray(body.offeredItems) ? (body.offeredItems as OfferItem[]) : []
    const requestedItems = Array.isArray(body.requestedItems) ? (body.requestedItems as OfferItem[]) : []

    // Require something of value depending on the offer type.
    if (offerType === "cash" && amount <= 0) {
      return NextResponse.json({ success: false, message: "Inserisci un importo valido." }, { status: 400 })
    }
    if (offerType === "item_coins" && coins <= 0 && offeredItems.length === 0) {
      return NextResponse.json({ success: false, message: "Aggiungi CollexCoins o un oggetto." }, { status: 400 })
    }
    if ((offerType === "item_cash" || offerType === "multi_trade") && offeredItems.length === 0) {
      return NextResponse.json({ success: false, message: "Aggiungi almeno un oggetto offerto." }, { status: 400 })
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
        return NextResponse.json({ success: false, message: "Non puoi proporti un'offerta." }, { status: 400 })
      }
      conversation = await getOrCreateConversation(sender, recipientId)
      if (!conversation) {
        return NextResponse.json({ success: false, message: "Destinatario non trovato." }, { status: 404 })
      }
    }

    const offer = buildOffer({
      offerType: offerType as "cash" | "item_cash" | "item_coins" | "multi_trade",
      proposerId: sender.userId,
      amount,
      coins,
      offeredItems,
      requestedItems,
      listingId: typeof body.listingId === "string" ? body.listingId : "",
      listingName: typeof body.listingName === "string" ? body.listingName : "",
      askValue: Number(body.askValue) || 0,
      category: typeof body.category === "string" ? body.category : "",
    })

    const created = await appendMessage(conversation, sender, {
      type: "offer",
      text: typeof body.text === "string" ? body.text : "",
      offer,
    })

    return NextResponse.json({
      success: true,
      message: "Offerta inviata.",
      conversationId: String(conversation._id),
      offer: { ...offer, _id: String((created as { _id?: unknown })._id) },
    })
  } catch (error) {
    console.error("[v0] Errore offer:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
