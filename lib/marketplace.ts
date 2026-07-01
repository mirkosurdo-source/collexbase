import type { Badge } from "@/lib/wallet"

// Marketplace commission rates by badge tier.
export const BUYER_FEES: Record<Badge, number> = { Base: 0.03, Gold: 0.02, Premium: 0.01 }
export const SELLER_FEES: Record<Badge, number> = { Base: 0.02, Gold: 0.015, Premium: 0.01 }

// Protected payments are held in escrow for 48h before release to the seller.
export const ESCROW_LOCK_MS = 48 * 60 * 60 * 1000

export type ListingMode = "fixed" | "trade" | "item_cash" | "item_coins"
export type OfferType = "buy" | "offer" | "counteroffer" | "trade" | "item_cash" | "item_coins"

function tier(badge: string): Badge {
  return (["Base", "Gold", "Premium"].includes(badge) ? badge : "Base") as Badge
}

/** Commission the buyer pays on top of the sale price. */
export function buyerFee(price: number, badge: string): number {
  return Math.round(price * BUYER_FEES[tier(badge)] * 100) / 100
}

/** Commission deducted from the seller's proceeds. */
export function sellerFee(price: number, badge: string): number {
  return Math.round(price * SELLER_FEES[tier(badge)] * 100) / 100
}

/** Full price breakdown for a protected purchase. */
export function priceBreakdown(price: number, buyerBadge: string, sellerBadge: string) {
  const bFee = buyerFee(price, buyerBadge)
  const sFee = sellerFee(price, sellerBadge)
  return {
    price,
    buyerFee: bFee,
    sellerFee: sFee,
    buyerTotal: Math.round((price + bFee) * 100) / 100,
    sellerNet: Math.round((price - sFee) * 100) / 100,
  }
}
