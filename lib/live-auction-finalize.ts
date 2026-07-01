import { createNotification } from "@/lib/notifications"
import { initPaymentTerms, FINE_CONFIG } from "@/lib/auction-fines"

/**
 * Blocco 43 — ends a live auction (idempotent) and fires the win/loss/seller
 * notifications. Because the serverless runtime has no scheduler, the status
 * endpoint calls this lazily when an auction's deadline has passed, and the
 * explicit "end" route calls it on demand.
 *
 * On a winning auction it records an internal order reference (`orderId`) and
 * deep-links the winner to complete checkout. It never touches the classic
 * auction/marketplace collections.
 */

// A mongoose document for a LiveAuction (loosely typed to avoid coupling).
interface LiveAuctionDoc {
  _id: unknown
  sellerId: string
  itemName: string
  currentPrice: number
  status: string
  endAt: Date
  highestBidderId?: string | null
  highestBidderUsername?: string
  orderId?: string | null
  chat: Array<Record<string, unknown>>
  // Blocco 51 — non-payment fine fields (additive).
  finalPrice?: number | null
  winnerId?: string | null
  paymentDeadline?: Date | null
  paymentStatus?: string
  finePercentage?: number
  fineApplied?: boolean
  fineAmountCollex?: number
  save: () => Promise<unknown>
}

/**
 * Finalizes the auction if it is live and its deadline passed (or force=true).
 * Returns true when a state change was persisted.
 */
export async function finalizeLiveAuctionIfEnded(auction: LiveAuctionDoc, opts: { force?: boolean } = {}): Promise<boolean> {
  const now = Date.now()
  const expired = new Date(auction.endAt).getTime() <= now
  if (auction.status !== "live") return false
  if (!opts.force && !expired) return false

  auction.status = "ended"

  const winnerId = auction.highestBidderId
  if (winnerId) {
    // Internal order reference (immediate-checkout pointer for the winner).
    auction.orderId = `live_${String(auction._id)}`
    // Blocco 51 — start the 48h payment window and compute the fine terms.
    initPaymentTerms(auction)
    auction.chat.push({
      userId: "system",
      username: "Sistema",
      message: `Asta aggiudicata a ${auction.highestBidderUsername || "vincitore"} per € ${auction.currentPrice}.`,
      system: true,
      createdAt: new Date(now),
    })
  } else {
    auction.chat.push({
      userId: "system",
      username: "Sistema",
      message: "Asta terminata senza offerte.",
      system: true,
      createdAt: new Date(now),
    })
  }

  await auction.save()

  // Seller notification.
  void createNotification({
    userId: auction.sellerId,
    type: "auction",
    title: "Asta live terminata",
    body: winnerId
      ? `"${auction.itemName}" aggiudicata a € ${auction.currentPrice}.`
      : `"${auction.itemName}" si è conclusa senza offerte.`,
    link: `/live-auction/${String(auction._id)}`,
  })

  // Winner notification (immediate payment prompt).
  if (winnerId && winnerId !== auction.sellerId) {
    void createNotification({
      userId: winnerId,
      type: "auction",
      title: "Hai vinto l'asta live!",
      body: `Ti sei aggiudicato "${auction.itemName}" per € ${auction.currentPrice}. Hai ${FINE_CONFIG.paymentWindowHours} ore per pagare: in caso contrario verrà applicata una multa di ${auction.fineAmountCollex ?? 0} CollexCoin al tuo wallet.`,
      link: `/live-auction/${String(auction._id)}`,
    })
  }

  return true
}
