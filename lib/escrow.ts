import { connectDB } from "@/lib/db"
import Wallet from "@/lib/models/Wallet"
import Listing from "@/lib/models/Listing"
import Escrow from "@/lib/models/Escrow"
import { getOrCreateWallet } from "@/lib/wallet"
import { priceBreakdown, ESCROW_LOCK_MS } from "@/lib/marketplace"
import { createNotification } from "@/lib/notifications"
import { recordSale } from "@/lib/marketplace2"
import { computeSellerRanking } from "@/lib/seller-ranking"

type ListingDoc = InstanceType<typeof Listing>

export interface LockResult {
  ok: boolean
  message: string
  escrow?: InstanceType<typeof Escrow>
}

/**
 * Locks a buyer's protected payment into escrow for 48h.
 * Deducts the buyer total (price + buyer fee) from their money balance.
 */
export async function lockPayment(buyerId: string, listing: ListingDoc, price: number): Promise<LockResult> {
  await connectDB()

  const [buyerWallet, sellerWallet] = await Promise.all([
    getOrCreateWallet(buyerId),
    getOrCreateWallet(String(listing.sellerId)),
  ])

  const breakdown = priceBreakdown(price, buyerWallet.badge, sellerWallet.badge)

  if (buyerWallet.money < breakdown.buyerTotal) {
    return { ok: false, message: `Fondi insufficienti. Servono € ${breakdown.buyerTotal.toFixed(2)}.` }
  }

  buyerWallet.money -= breakdown.buyerTotal
  buyerWallet.transactions.push({
    type: "purchase",
    currency: "money",
    amount: breakdown.buyerTotal,
    description: `Pagamento protetto: ${listing.itemName}`,
    status: "locked",
    createdAt: new Date(),
  })
  await buyerWallet.save()

  const escrow = await Escrow.create({
    listingId: listing._id,
    listingName: listing.itemName,
    buyerId,
    sellerId: listing.sellerId,
    price: breakdown.price,
    buyerFee: breakdown.buyerFee,
    sellerFee: breakdown.sellerFee,
    sellerNet: breakdown.sellerNet,
    status: "locked",
    lockedAt: new Date(),
    releaseAt: new Date(Date.now() + ESCROW_LOCK_MS),
  })

  listing.status = "pending"
  listing.soldTo = buyerId as unknown as ListingDoc["soldTo"]
  await listing.save()

  await createNotification({
    userId: String(listing.sellerId),
    type: "system",
    title: "Pagamento in deposito",
    body: `Il pagamento protetto per "${listing.itemName}" è stato bloccato. Spedisci l'oggetto per ricevere l'accredito.`,
    link: "/wallet/transactions",
  })

  return { ok: true, message: "Pagamento bloccato in deposito per 48h.", escrow }
}

/** Releases escrow funds to the seller (buyer confirmation or 48h elapsed). */
export async function releasePayment(escrowId: string, actorId: string): Promise<LockResult> {
  await connectDB()
  const escrow = await Escrow.findById(escrowId)
  if (!escrow) return { ok: false, message: "Deposito non trovato." }
  if (escrow.status === "released") return { ok: false, message: "Pagamento già accreditato." }
  if (escrow.status === "refunded") return { ok: false, message: "Pagamento già rimborsato." }

  const elapsed = Date.now() >= new Date(escrow.releaseAt).getTime()
  const isBuyer = String(escrow.buyerId) === actorId
  if (!isBuyer && !elapsed) {
    return { ok: false, message: "Solo l'acquirente può confermare prima delle 48h." }
  }

  const sellerWallet = await getOrCreateWallet(String(escrow.sellerId))
  sellerWallet.money += escrow.sellerNet
  sellerWallet.transactions.push({
    type: "sale",
    currency: "money",
    amount: escrow.sellerNet,
    description: `Vendita accreditata: ${escrow.listingName}`,
    status: "completed",
    createdAt: new Date(),
  })
  await sellerWallet.save()

  escrow.status = "released"
  escrow.releasedAt = new Date()
  await escrow.save()

  await Listing.updateOne({ _id: escrow.listingId }, { status: "sold" })

  await createNotification({
    userId: String(escrow.sellerId),
    type: "system",
    title: "Vendita accreditata",
    body: `Hai ricevuto € ${escrow.sellerNet.toFixed(2)} per "${escrow.listingName}".`,
    link: "/wallet",
  })

  // Blocco 47 — record the completed sale into price history (fires alerts) and
  // refresh the seller ranking. Fire-and-forget: never blocks the payout flow.
  const soldListing = (await Listing.findById(escrow.listingId).select("itemName category").lean()) as {
    itemName?: string
    category?: string
  } | null
  recordSale({
    name: soldListing?.itemName || escrow.listingName,
    category: soldListing?.category || "",
    price: escrow.price,
    source: "marketplace",
  }).catch(() => {})
  computeSellerRanking(String(escrow.sellerId)).catch(() => {})

  return { ok: true, message: "Pagamento accreditato al venditore.", escrow }
}

/** Refunds a locked payment back to the buyer. */
export async function refundPayment(escrowId: string): Promise<LockResult> {
  await connectDB()
  const escrow = await Escrow.findById(escrowId)
  if (!escrow) return { ok: false, message: "Deposito non trovato." }
  if (escrow.status !== "locked" && escrow.status !== "shipped") {
    return { ok: false, message: "Questo deposito non può essere rimborsato." }
  }

  const buyerWallet = await getOrCreateWallet(String(escrow.buyerId))
  const refundTotal = Math.round((escrow.price + escrow.buyerFee) * 100) / 100
  buyerWallet.money += refundTotal
  buyerWallet.transactions.push({
    type: "deposit",
    currency: "money",
    amount: refundTotal,
    description: `Rimborso acquisto: ${escrow.listingName}`,
    status: "completed",
    createdAt: new Date(),
  })
  await buyerWallet.save()

  escrow.status = "refunded"
  await escrow.save()

  await Listing.updateOne({ _id: escrow.listingId }, { status: "active", soldTo: null })

  await createNotification({
    userId: String(escrow.buyerId),
    type: "system",
    title: "Rimborso effettuato",
    body: `Hai ricevuto un rimborso di € ${refundTotal.toFixed(2)} per "${escrow.listingName}".`,
    link: "/wallet/transactions",
  })

  return { ok: true, message: "Rimborso effettuato.", escrow }
}
