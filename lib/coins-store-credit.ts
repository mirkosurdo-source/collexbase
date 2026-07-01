import { connectDB } from "@/lib/db"
import CoinStorePurchase from "@/lib/models/CoinStorePurchase"
import { getOrCreateWallet } from "@/lib/wallet"
import { notifyCoinsPurchase } from "@/lib/coins-notifications"

/**
 * Credits a pending CoinStorePurchase to the user's wallet exactly once.
 *
 * Idempotent: a purchase already marked "completed" is a no-op. Uses an atomic
 * findOneAndUpdate guarded by status === "pending" so concurrent confirm calls
 * (e.g. success redirect + a retry) can never double-credit.
 */
export async function creditCoinPurchase(
  purchaseId: string,
): Promise<{ ok: boolean; alreadyCredited?: boolean; coins?: number; balance?: number }> {
  await connectDB()

  // Atomically claim the purchase: only the first caller flips pending→completed.
  const claimed = await CoinStorePurchase.findOneAndUpdate(
    { _id: purchaseId, status: "pending" },
    { status: "completed", creditedAt: new Date() },
    { new: true },
  )

  if (!claimed) {
    const existing = await CoinStorePurchase.findById(purchaseId)
    if (existing && existing.status === "completed") {
      return { ok: true, alreadyCredited: true, coins: existing.coins }
    }
    return { ok: false }
  }

  const purchase = claimed

  const wallet = await getOrCreateWallet(purchase.userId)
  wallet.coins += purchase.coins
  wallet.transactions.push({
    type: "coins_purchase",
    currency: "coins",
    amount: purchase.coins,
    description: `Acquisto Store: ${purchase.coins} CollexCoins (€ ${purchase.finalPrice.toFixed(2)})`,
    status: "completed",
    createdAt: new Date(),
  })
  await wallet.save()

  void notifyCoinsPurchase({
    userId: purchase.userId,
    coins: purchase.coins,
    savings: purchase.savings,
    tier: purchase.tier,
  })

  return { ok: true, coins: purchase.coins, balance: wallet.coins }
}
