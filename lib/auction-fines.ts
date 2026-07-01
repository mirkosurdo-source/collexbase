import { connectDB } from "@/lib/db"
import LiveAuction from "@/lib/models/LiveAuction"
import Listing from "@/lib/models/Listing"
import { createNotification } from "@/lib/notifications"
import { recordTransaction } from "@/lib/collexcoin"

/**
 * Blocco 51 — automatic non-payment fine for Live Auctions (CollexCoin, opzione B).
 *
 * Fully additive engine. When a live auction is won, the winner has 48h to pay.
 * Reminders fire at 24h and 46h; at the 48h deadline a fine in CollexCoin is
 * debited from the winner's balance (which may go negative — internal debt) and
 * the seller's product is unlocked so it can be relisted, sold or kept.
 *
 * Because the serverless runtime has no persistent scheduler, the reminder and
 * fine sweeps run from cron endpoints (Vercel Cron) and are fully idempotent.
 */

/** Fine configuration. */
export const FINE_CONFIG = {
  /** Hours the winner has to complete payment. */
  paymentWindowHours: 48,
  /** Fine as a percentage of the final price, charged in CollexCoin. */
  finePercentage: 20,
  /** Reminder checkpoints (hours after win). */
  reminder1Hours: 24,
  reminder2Hours: 46,
} as const

/** Milliseconds in the payment window. */
export const PAYMENT_WINDOW_MS = FINE_CONFIG.paymentWindowHours * 60 * 60 * 1000

/** Computes the fine amount in CollexCoin for a given final price. */
export function computeFineAmount(finalPrice: number, finePercentage = FINE_CONFIG.finePercentage): number {
  return Math.max(0, Math.round((Number(finalPrice) || 0) * finePercentage) / 100)
}

/**
 * Initializes the payment deadline + fine fields on a won auction document.
 * Mutates the passed document but does NOT save it (the caller persists).
 */
export function initPaymentTerms(auction: {
  currentPrice: number
  highestBidderId?: string | null
  finalPrice?: number | null
  winnerId?: string | null
  paymentDeadline?: Date | null
  paymentStatus?: string
  finePercentage?: number
  fineApplied?: boolean
  fineAmountCollex?: number
}): void {
  const finalPrice = Number(auction.currentPrice) || 0
  auction.finalPrice = finalPrice
  auction.winnerId = auction.highestBidderId ? String(auction.highestBidderId) : null
  auction.paymentDeadline = new Date(Date.now() + PAYMENT_WINDOW_MS)
  auction.paymentStatus = "pending"
  auction.finePercentage = FINE_CONFIG.finePercentage
  auction.fineApplied = false
  auction.fineAmountCollex = computeFineAmount(finalPrice)
}

/**
 * Marks a won auction as paid (winner completed checkout). Idempotent.
 * Returns the updated status or an error reason.
 */
export async function markAuctionPaid(
  auctionId: string,
  userId: string,
): Promise<{ ok: boolean; status?: string; message?: string }> {
  await connectDB()
  const auction = await LiveAuction.findById(auctionId)
  if (!auction) return { ok: false, message: "Asta non trovata." }
  if (String(auction.winnerId || auction.highestBidderId || "") !== String(userId)) {
    return { ok: false, message: "Solo il vincitore può completare il pagamento." }
  }
  if (auction.paymentStatus === "paid") return { ok: true, status: "paid" }
  if (auction.paymentStatus === "expired" || auction.fineApplied) {
    return { ok: false, message: "Il termine di pagamento è scaduto." }
  }

  auction.paymentStatus = "paid"
  await auction.save()

  void createNotification({
    userId: auction.sellerId,
    type: "payment",
    title: "Pagamento ricevuto",
    body: `Il vincitore ha pagato "${auction.itemName}" (€ ${auction.finalPrice ?? auction.currentPrice}).`,
    link: `/live-auction/${String(auction._id)}`,
  })

  return { ok: true, status: "paid" }
}

/** Hours elapsed since the win (deadline minus the fixed window). */
function hoursSinceWin(deadline: Date): number {
  const winAt = new Date(deadline).getTime() - PAYMENT_WINDOW_MS
  return (Date.now() - winAt) / (1000 * 60 * 60)
}

/**
 * Sweep pending auctions and fire the 24h / 46h reminders. Idempotent: each
 * reminder is guarded by a persisted flag so it is sent at most once.
 */
export async function runReminderSweep(): Promise<{ reminded24: number; reminded46: number }> {
  await connectDB()
  const now = new Date()
  const pending = await LiveAuction.find({
    paymentStatus: "pending",
    paymentDeadline: { $gt: now },
  })

  let reminded24 = 0
  let reminded46 = 0

  for (const auction of pending) {
    if (!auction.paymentDeadline || !auction.winnerId) continue
    const elapsed = hoursSinceWin(auction.paymentDeadline)
    const fine = auction.fineAmountCollex ?? computeFineAmount(auction.finalPrice ?? auction.currentPrice)

    if (!auction.reminder24Sent && elapsed >= FINE_CONFIG.reminder1Hours) {
      auction.reminder24Sent = true
      await auction.save()
      void createNotification({
        userId: String(auction.winnerId),
        type: "payment",
        title: "Promemoria pagamento asta",
        body: `Hai ancora tempo per pagare "${auction.itemName}". Se non paghi entro 48 ore verrà applicata una multa di ${fine} CollexCoin.`,
        link: `/live-auction/${String(auction._id)}`,
      })
      reminded24++
    }

    if (!auction.reminder46Sent && elapsed >= FINE_CONFIG.reminder2Hours) {
      auction.reminder46Sent = true
      await auction.save()
      void createNotification({
        userId: String(auction.winnerId),
        type: "payment",
        title: "Ultime ore per pagare",
        body: `Mancano meno di 2 ore alla scadenza per "${auction.itemName}". Se non paghi verrà applicata una multa di ${fine} CollexCoin e il prodotto tornerà al venditore.`,
        link: `/live-auction/${String(auction._id)}`,
      })
      reminded46++
    }
  }

  return { reminded24, reminded46 }
}

/**
 * Unlocks the seller's product after a non-payment. Best-effort: the live
 * auction may not reference a marketplace listing, so this is a no-op when no
 * matching active listing is found. Restores a non-sold listing to "active".
 */
async function unlockListing(itemId: string): Promise<void> {
  if (!itemId) return
  try {
    await Listing.updateOne(
      { _id: itemId, status: { $in: ["pending", "cancelled"] } },
      { $set: { status: "active" } },
    )
  } catch {
    // Listing id may not be a marketplace listing; ignore.
  }
}

/**
 * Sweep expired pending auctions and apply the fine. For each: debit the fine in
 * CollexCoin (allowing a negative balance — opzione B), notify the winner, unlock
 * the seller's product and notify the seller. Idempotent via `fineApplied`.
 */
export async function runFineSweep(): Promise<{ fined: number }> {
  await connectDB()
  const now = new Date()
  const expired = await LiveAuction.find({
    paymentStatus: "pending",
    paymentDeadline: { $lt: now },
    fineApplied: false,
  })

  let fined = 0

  for (const auction of expired) {
    const fine = auction.fineAmountCollex ?? computeFineAmount(auction.finalPrice ?? auction.currentPrice)

    // Mark first so a concurrent sweep cannot double-charge.
    auction.paymentStatus = "expired"
    auction.fineApplied = true
    await auction.save()

    if (auction.winnerId && fine > 0) {
      await recordTransaction({
        userId: String(auction.winnerId),
        amount: -fine,
        type: "auction_fine",
        description: `Multa mancato pagamento asta "${auction.itemName}"`,
        allowNegative: true,
      })

      void createNotification({
        userId: String(auction.winnerId),
        type: "payment",
        title: "Multa applicata",
        body: `Non hai completato il pagamento entro 48 ore. È stata applicata una multa di ${fine} CollexCoin al tuo wallet. Il prodotto è stato restituito al venditore.`,
        link: `/live-auction/${String(auction._id)}`,
      })
    }

    // Unlock the seller's product (best-effort).
    await unlockListing(String(auction.itemId || ""))

    void createNotification({
      userId: auction.sellerId,
      type: "auction",
      title: "Prodotto sbloccato",
      body: `L'acquirente non ha pagato "${auction.itemName}" entro 48 ore. Il prodotto è stato sbloccato: puoi rimetterlo in asta, venderlo o tenerlo.`,
      link: `/live-auction/${String(auction._id)}`,
    })

    fined++
  }

  return { fined }
}
