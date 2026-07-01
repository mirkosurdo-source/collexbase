import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Conversation from "@/lib/models/Conversation"
import {
  authMessenger,
  appendMessage,
  isParticipant,
  buildOffer,
  setOfferStatus,
} from "@/lib/messages"
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
    const originalMessageId = typeof body.messageId === "string" ? body.messageId : ""
    const offerType = String(body.offerType || "")

    if (!conversationId || !originalMessageId) {
      return NextResponse.json({ success: false, message: "Riferimenti mancanti." }, { status: 400 })
    }
    if (!VALID_TYPES.includes(offerType)) {
      return NextResponse.json({ success: false, message: "Tipo di offerta non valido." }, { status: 400 })
    }

    await connectDB()

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversazione non trovata." }, { status: 404 })
    }
    if (!isParticipant(conversation, sender.userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    // Mark the original offer as countered (only the recipient may counter).
    const result = await setOfferStatus(conversation, originalMessageId, "countered", sender)
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error }, { status: result.status || 400 })
    }

    const offeredItems = Array.isArray(body.offeredItems) ? (body.offeredItems as OfferItem[]) : []
    const requestedItems = Array.isArray(body.requestedItems) ? (body.requestedItems as OfferItem[]) : []

    const offer = buildOffer({
      offerType: offerType as "cash" | "item_cash" | "item_coins" | "multi_trade",
      proposerId: sender.userId,
      amount: Number(body.amount) || 0,
      coins: Number(body.coins) || 0,
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
      message: "Controproposta inviata.",
      conversationId: String(conversation._id),
      offer: { ...offer, _id: String((created as { _id?: unknown })._id) },
    })
  } catch (error) {
    console.error("[v0] Errore counteroffer:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
