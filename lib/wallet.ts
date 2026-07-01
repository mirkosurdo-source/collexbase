import { connectDB } from "@/lib/db"
import Wallet from "@/lib/models/Wallet"

export type Badge = "Base" | "Gold" | "Premium"

// Daily reward coins per badge tier.
export const DAILY_REWARD: Record<Badge, number> = { Base: 1, Gold: 5, Premium: 10 }
// Weekly bonus coins per badge tier.
export const WEEKLY_REWARD: Record<Badge, number> = { Base: 10, Gold: 35, Premium: 70 }
// Monthly bonus coins per badge tier.
export const MONTHLY_REWARD: Record<Badge, number> = { Base: 50, Gold: 150, Premium: 300 }
// One-time signup bonus per badge tier.
export const SIGNUP_BONUS: Record<Badge, number> = { Base: 100, Gold: 200, Premium: 300 }

// Available CollexCoins store packages.
export const COIN_PACKAGES = [
  { coins: 50, price: 0.99 },
  { coins: 250, price: 3.99 },
  { coins: 1000, price: 12.99 },
  { coins: 5000, price: 49.99 },
  { coins: 10000, price: 89.99 },
]

// Sale credits are locked for 48 hours before becoming withdrawable.
export const SALE_LOCK_MS = 48 * 60 * 60 * 1000

type WalletDoc = InstanceType<typeof Wallet>

/** Returns the user's wallet, creating a default one on first access. */
export async function getOrCreateWallet(userId: string): Promise<WalletDoc> {
  await connectDB()
  let wallet = await Wallet.findOne({ userId })
  if (!wallet) {
    wallet = await Wallet.create({ userId })
  }
  return wallet
}

/**
 * Moves any matured locked sale credits into the spendable money balance.
 * Mutates and saves the wallet when something is released.
 */
export async function releaseMaturedCredits(wallet: WalletDoc): Promise<WalletDoc> {
  const now = Date.now()
  let changed = false

  for (const credit of wallet.lockedCredits) {
    if (!credit.released && new Date(credit.releaseAt).getTime() <= now) {
      credit.released = true
      wallet.money += credit.amount
      wallet.transactions.push({
        type: "release",
        currency: "money",
        amount: credit.amount,
        description: `Accredito sbloccato: ${credit.source}`,
        status: "completed",
        createdAt: new Date(),
      })
      changed = true
    }
  }

  if (changed) await wallet.save()
  return wallet
}

/** Total value of locked credits not yet released. */
export function pendingLockedTotal(wallet: WalletDoc): number {
  return wallet.lockedCredits
    .filter((c: { released: boolean }) => !c.released)
    .reduce((sum: number, c: { amount: number }) => sum + c.amount, 0)
}
