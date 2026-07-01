import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Offer from "@/lib/models/Offer"
import Listing from "@/lib/models/Listing"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"
import { evaluateFairness, COINS_TO_EUR } from "@/lib/ai-advisor"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { offerId, amount = 0, coins = 0, message = "" } = body
    if (!offerId) {
      return NextResponse.json({ success: false, message: "ID offerta mancante." }, { status: 400 })
    }

    await connectDB()
    const parent = await Offer.findById(offerId)
    if (!parent || parent.status !== "pending") {
      return NextResponse.json({ success: false, message: "Offerta non disponibile." }, { status: 404 })
    }

    const isSeller = String(parent.sellerId) === userId
    const isBuyer = String(parent.buyerId) === userId
    if (!isSeller && !isBuyer) {
      return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 403 })
    }

    const listing = await Listing.findById(parent.listingId)
    const askValue = listing?.price ?? parent.offerValue
    const offerValue = (Number(amount) || 0) + (Number(coins) || 0) * COINS_TO_EUR
    const fairness = evaluateFairness({ askValue, offerValue })

    // Mark the parent as countered and create the reverse-direction counteroffer.
    parent.status = "countered"
    await parent.save()

    const actor = await User.findById(userId).select("username")

    const counter = await Offer.create({
      listingId: parent.listingId,
      listingName: parent.listingName,
      sellerId: parent.sellerId,
      buyerId: parent.buyerId,
      buyerUsername: parent.buyerUsername,
      type: "counteroffer",
      amount: Number(amount) || 0,
      coins: Number(coins) || 0,
      offeredItems: [],
      offerValue: Math.round(offerValue * 100) / 100,
      fairnessScore: fairness.score,
      fairnessVerdict: fairness.verdict,
      message,
      status: "pending",
      fromSeller: isSeller,
      parentOfferId: parent._id,
    })

    const recipientId = isSeller ? String(parent.buyerId) : String(parent.sellerId)
    await createNotification({
      userId: recipientId,
      type: "trade",
      title: "Controproposta ricevuta",
      body: `${actor?.username || "Un utente"} ha inviato una controproposta di € ${amount} per "${parent.listingName}".`,
      link: "/market/offers",
    })

    return NextResponse.json({ success: true, message: "Controproposta inviata.", offer: counter, fairness })
  } catch (error) {
    console.error("[v0] market/counteroffer error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
