import type { PlanId } from "@/lib/subscription"

/**
 * Blocco 23 — CollexCoins Store.
 *
 * Self-contained pricing module for the official coin store. This deliberately
 * does NOT reuse lib/wallet.ts `COIN_PACKAGES` (different prices) so the existing
 * coin-buy flow keeps working untouched.
 */

/** Official coin value: 1 CollexCoin = € 0,05. */
export const COIN_VALUE_EUR = 0.05

export interface StorePackageDef {
  id: string
  coins: number
  /** Store list price (the public, pre-tier-discount price). */
  storePrice: number
}

/**
 * The five official store packages. `storePrice` is the catalog price; the real
 * value is derived from COIN_VALUE_EUR so the strikethrough is always coherent.
 */
export const STORE_PACKAGES: StorePackageDef[] = [
  { id: "coins_50", coins: 50, storePrice: 2.5 },
  { id: "coins_250", coins: 250, storePrice: 10.0 },
  { id: "coins_1000", coins: 1000, storePrice: 32.0 },
  { id: "coins_5000", coins: 5000, storePrice: 150.0 },
  { id: "coins_10000", coins: 10000, storePrice: 200.0 },
]

/** Extra discount granted on top of the store price by subscription tier. */
export const TIER_EXTRA_DISCOUNT: Record<PlanId, number> = {
  Base: 0,
  Gold: 0.05,
  Premium: 0.1,
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface PricedPackage {
  id: string
  coins: number
  /** coins × 0,05 — the "real" value shown with a strikethrough. */
  realValue: number
  /** Catalog/list price before any tier discount. */
  storePrice: number
  /** Catalog discount vs real value, e.g. 36 for -36%. */
  baseDiscountPct: number
  /** Extra tier discount fraction applied to the store price (0 / 0.05 / 0.1). */
  tierDiscountPct: number
  /** Price actually charged after the tier discount. */
  finalPrice: number
  /** realValue − finalPrice. */
  savings: number
  /** Total discount vs real value after tier, e.g. 42 for -42%. */
  totalDiscountPct: number
  tier: PlanId
}

/** Prices a single package definition for a given subscription tier. */
export function pricePackage(def: StorePackageDef, tier: PlanId): PricedPackage {
  const realValue = round2(def.coins * COIN_VALUE_EUR)
  const baseDiscountPct = Math.round((1 - def.storePrice / realValue) * 100)
  const tierExtra = TIER_EXTRA_DISCOUNT[tier] ?? 0
  const finalPrice = round2(def.storePrice * (1 - tierExtra))
  const savings = round2(realValue - finalPrice)
  const totalDiscountPct = Math.round((1 - finalPrice / realValue) * 100)

  return {
    id: def.id,
    coins: def.coins,
    realValue,
    storePrice: def.storePrice,
    baseDiscountPct: Math.max(0, baseDiscountPct),
    tierDiscountPct: tierExtra,
    finalPrice,
    savings: Math.max(0, savings),
    totalDiscountPct: Math.max(0, totalDiscountPct),
    tier,
  }
}

/** Prices every package for a tier (used by the store + packages API). */
export function priceAllPackages(tier: PlanId): PricedPackage[] {
  return STORE_PACKAGES.map((def) => pricePackage(def, tier))
}

/** Looks up and prices a package by id; returns null when unknown. */
export function getPricedPackage(id: string, tier: PlanId): PricedPackage | null {
  const def = STORE_PACKAGES.find((p) => p.id === id)
  return def ? pricePackage(def, tier) : null
}
