import type { PlanId } from "@/lib/subscription"
import { recordTransaction, getOrCreateBalance } from "@/lib/collexcoin"

/**
 * Trade settlement share paid in Collex Coin, by tier (Blocco 16, section 6).
 * Base 90% / Gold 75% / Premium 55% of the item value.
 */
export const TRADE_COIN_RATES: Record<PlanId, number> = {
  Base: 0.9,
  Gold: 0.75,
  Premium: 0.55,
}

/** Collex Coin required to settle a trade for an item worth `itemValue`. */
export function calculateTradeCoinCost(tier: PlanId, itemValue: number): number {
  const v = Math.max(0, Number(itemValue) || 0)
  return Math.round(v * (TRADE_COIN_RATES[tier] ?? TRADE_COIN_RATES.Base))
}

/**
 * Deducts `amount` Collex Coin from a user as a trade settlement cost. Delegates
 * to the existing Collex Coin ledger primitive (no changes to its logic).
 * Returns the result of the ledger operation.
 */
export async function applyTradeCoinCost(
  userId: string,
  amount: number,
  description = "Costo scambio in Collex Coin",
): Promise<{ ok: boolean; balance: number; error?: string }> {
  const cost = Math.max(0, Math.round(Number(amount) || 0))
  if (cost === 0) {
    const bal = await getOrCreateBalance(userId)
    return { ok: true, balance: bal.balance }
  }
  return recordTransaction({
    userId,
    amount: -cost,
    type: "trade_fee",
    description,
  })
}
