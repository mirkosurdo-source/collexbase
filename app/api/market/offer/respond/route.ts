import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Offer from "@/lib/models/Offer"
import Listing from "@/lib/models/Listing"
import { getAuthUserId } from "@/lib/auth/request"
import { createNotification } from "@/lib/notifications"
import { lockPayment } from "@/lib/escrow"
import { processAutoOfferAfterReject, closeAutoOfferOnAccept } from "@/lib/marketplace2"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { offerId, action } = body
    if (!offerId || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ success: false, message: "Dati non validi." }, { status: 400 })
    }

    await connectDB()
    const offer = await Offer.findById(offerId)
    if (!offer || offer.status !== "pending") {
      return NextResponse.json({ success: false, message: "Offerta non disponibile." }, { status: 404 })
    }

    // The recipient is the party who did NOT send this (counter)offer.
    const recipientId = offer.fromSeller ? String(offer.buyerId) : String(offer.sellerId)
    if (recipientId !== userId) {
      return NextResponse.json({ success: false, message: "Non puoi rispondere a questa offerta." }, { status: 403 })
    }

    if (action === "reject") {
      offer.status = "rejected"
      await offer.save()
      await createNotification({
        userId: String(offer.buyerId),
        type: "trade",
        title: "Offerta rifiutata",
        body: `La tua offerta per "${offer.listingName}" è stata rifiutata.`,
        link: "/market/offers",
      })
      // Blocco 47 — if the buyer has an active auto-offer on this listing, bump it.
      await processAutoOfferAfterReject({
        listingId: String(offer.listingId),
        buyerId: String(offer.buyerId),
      }).catch(() => {})
      return NextResponse.json({ success: true, message: "Offerta rifiutata." })
    }

    // Accept
    const listing = await Listing.findById(offer.listingId)
    if (!listing || (listing.status !== "active" && listing.status !== "pending")) {
      return NextResponse.json({ success: false, message: "Annuncio non più disponibile." }, { status: 400 })
    }

    // If there is a cash component, lock it in a protected payment.
    let escrowId: string | null = null
    if (offer.amount > 0) {
      const result = await lockPayment(String(offer.buyerId), listing, offer.amount)
      if (!result.ok) {
        return NextResponse.json({ success: false, message: `Accettazione non riuscita: ${result.message}` }, { status: 400 })
      }
      escrowId = result.escrow ? String(result.escrow._id) : null
    } else {
      // Pure trade/coins: reserve the listing without a cash escrow.
      listing.status = "pending"
      listing.soldTo = offer.buyerId
      await listing.save()
    }

    offer.status = "accepted"
    await offer.save()

    // Reject all other pending offers on the same listing.
    await Offer.updateMany(
      { listingId: offer.listingId, _id: { $ne: offer._id }, status: "pending" },
      { status: "rejected" },
    )

    await createNotification({
      userId: String(offer.buyerId),
      type: "trade",
      title: "Offerta accettata",
      body: `La tua offerta per "${offer.listingName}" è stata accettata.`,
      link: "/market/offers",
    })

    // Blocco 47 — stop any active auto-offer now that a deal is struck.
    await closeAutoOfferOnAccept(String(offer.buyerId), String(offer.listingId)).catch(() => {})

    return NextResponse.json({ success: true, message: "Offerta accettata.", escrowId })
  } catch (error) {
    console.error("[v0] market/offer/respond error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
