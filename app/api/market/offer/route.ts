import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Listing from "@/lib/models/Listing"
import Offer from "@/lib/models/Offer"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"
import { evaluateFairness, COINS_TO_EUR } from "@/lib/ai-advisor"

type OfferedItem = { itemId?: string; name?: string; image?: string; value?: number }

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { listingId, type, amount = 0, coins = 0, offeredItems = [], message = "" } = body

    if (!listingId || !type) {
      return NextResponse.json({ success: false, message: "Dati offerta incompleti." }, { status: 400 })
    }

    await connectDB()
    const listing = await Listing.findById(listingId)
    if (!listing || listing.status !== "active") {
      return NextResponse.json({ success: false, message: "Annuncio non disponibile." }, { status: 404 })
    }
    if (String(listing.sellerId) === userId) {
      return NextResponse.json({ success: false, message: "Non puoi fare offerte sui tuoi annunci." }, { status: 400 })
    }

    // Validate the offer type against what the listing accepts.
    if (type === "trade" && !listing.acceptsTrade) {
      return NextResponse.json({ success: false, message: "Questo annuncio non accetta scambi." }, { status: 400 })
    }
    if (type === "item_cash" && !listing.acceptsItemPlusCash) {
      return NextResponse.json({ success: false, message: "Questo annuncio non accetta oggetto + denaro." }, { status: 400 })
    }
    if (type === "item_coins" && !listing.acceptsItemPlusCoins) {
      return NextResponse.json({ success: false, message: "Questo annuncio non accetta oggetto + monete." }, { status: 400 })
    }

    const items = Array.isArray(offeredItems) ? (offeredItems as OfferedItem[]) : []
    const itemsValue = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0)
    const offerValue = (Number(amount) || 0) + (Number(coins) || 0) * COINS_TO_EUR + itemsValue

    const fairness = evaluateFairness({ askValue: listing.price, offerValue })

    const user = await User.findById(userId).select("username")

    const offer = await Offer.create({
      listingId,
      listingName: listing.itemName,
      sellerId: listing.sellerId,
      buyerId: userId,
      buyerUsername: user?.username || "utente",
      type,
      amount: Number(amount) || 0,
      coins: Number(coins) || 0,
      offeredItems: items.map((it) => ({
        itemId: it.itemId,
        name: it.name || "",
        image: it.image || "",
        value: Number(it.value) || 0,
      })),
      offerValue: Math.round(offerValue * 100) / 100,
      fairnessScore: fairness.score,
      fairnessVerdict: fairness.verdict,
      message,
      status: "pending",
      fromSeller: false,
    })

    await createNotification({
      userId: String(listing.sellerId),
      type: "trade",
      title: "Nuova offerta ricevuta",
      body: `${user?.username || "Un utente"} ha inviato un'offerta su "${listing.itemName}".`,
      link: "/market/offers",
    })

    return NextResponse.json({ success: true, message: "Offerta inviata.", offer, fairness })
  } catch (error) {
    console.error("[v0] market/offer error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
