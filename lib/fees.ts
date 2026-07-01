import type { PlanId } from "@/lib/subscription"

/**
 * Real-money (EUR) commission rates for Blocco 16, expressed as fractions.
 * These intentionally live separate from lib/marketplace.ts so the existing
 * marketplace logic is left untouched.
 */
export const BUYER_FEE_RATES: Record<PlanId, number> = {
  Base: 0.03, // 3%
  Gold: 0.02, // 2%
  Premium: 0.01, // 1%
}

export const SELLER_FEE_RATES: Record<PlanId, number> = {
  Base: 0.02, // 2%
  Gold: 0.015, // 1.5%
  Premium: 0.01, // 1%
}

export const TRADE_FEE_RATES: Record<PlanId, number> = {
  Base: 0.05, // 5%
  Gold: 0.03, // 3%
  Premium: 0, // 0%
}

/** Rounds a monetary amount to 2 decimals (cent precision). */
export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100
}

function rate(map: Record<PlanId, number>, tier: PlanId): number {
  return map[tier] ?? map.Base
}

/** Buyer-side marketplace commission in EUR. */
export function calculateBuyerFee(tier: PlanId, amount: number): number {
  return roundMoney(Math.max(0, amount) * rate(BUYER_FEE_RATES, tier))
}

/** Seller-side marketplace commission in EUR. */
export function calculateSellerFee(tier: PlanId, amount: number): number {
  return roundMoney(Math.max(0, amount) * rate(SELLER_FEE_RATES, tier))
}

/** Trade settlement commission in EUR. */
export function calculateTradeFee(tier: PlanId, amount: number): number {
  return roundMoney(Math.max(0, amount) * rate(TRADE_FEE_RATES, tier))
}

export interface FeeBreakdown {
  amount: number
  buyerFee: number
  sellerFee: number
  /** Total the buyer is charged (item + buyer fee). */
  buyerTotal: number
  /** Net amount the seller receives (item - seller fee). */
  sellerNet: number
  /** Total commission CollexBase retains. */
  platformTotal: number
  buyerTier: PlanId
  sellerTier: PlanId
}

/**
 * Full buyer/seller fee breakdown for a marketplace sale at `amount` EUR.
 * Buyer and seller can be on different tiers.
 */
export function calculateFeeBreakdown(opts: {
  amount: number
  buyerTier: PlanId
  sellerTier: PlanId
}): FeeBreakdown {
  const amount = roundMoney(Math.max(0, opts.amount))
  const buyerFee = calculateBuyerFee(opts.buyerTier, amount)
  const sellerFee = calculateSellerFee(opts.sellerTier, amount)
  return {
    amount,
    buyerFee,
    sellerFee,
    buyerTotal: roundMoney(amount + buyerFee),
    sellerNet: roundMoney(amount - sellerFee),
    platformTotal: roundMoney(buyerFee + sellerFee),
    buyerTier: opts.buyerTier,
    sellerTier: opts.sellerTier,
  }
}
