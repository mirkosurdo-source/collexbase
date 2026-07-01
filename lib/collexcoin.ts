import { connectDB } from "@/lib/db"
import CollexCoinBalance from "@/lib/models/CollexCoinBalance"
import CollexCoinTransaction, { type CollexTxType } from "@/lib/models/CollexCoinTransaction"
import { getOrCreateSubState, PLANS, type PlanId } from "@/lib/subscription"

/**
 * Premium users receive a discount on internal Collex Coin fees / exclusive
 * features (Blocco 15.1, section 3). Expressed as a fraction off the cost.
 */
export const PREMIUM_COIN_DISCOUNT = 0.5

type BalanceDoc = InstanceType<typeof CollexCoinBalance>

/** Returns the user's Collex Coin balance doc, creating it on first access. */
export async function getOrCreateBalance(userId: string): Promise<BalanceDoc> {
  await connectDB()
  let bal = await CollexCoinBalance.findOne({ userId })
  if (!bal) bal = await CollexCoinBalance.create({ userId, balance: 0 })
  return bal
}

/**
 * Core ledger primitive: applies a signed `amount` to the balance and appends a
 * transaction. Debits that would push the balance below zero are rejected
 * unless `allowNegative` is set. Returns the new balance, or null if rejected.
 */
export async function recordTransaction(opts: {
  userId: string
  amount: number
  type: CollexTxType
  description?: string
  allowNegative?: boolean
}): Promise<{ ok: boolean; balance: number; error?: string }> {
  const { userId, amount, type, description = "", allowNegative = false } = opts
  const bal = await getOrCreateBalance(userId)

  const next = bal.balance + amount
  if (next < 0 && !allowNegative) {
    return { ok: false, balance: bal.balance, error: "Saldo Collex Coin insufficiente." }
  }

  // Opzione B (Blocco 51): when negatives are allowed the balance can become an
  // internal debt; otherwise it is floored at zero as before.
  bal.balance = allowNegative ? next : Math.max(0, next)
  await bal.save()

  await CollexCoinTransaction.create({
    userId,
    amount,
    type,
    description,
    balanceAfter: bal.balance,
  })

  return { ok: true, balance: bal.balance }
}

/** True if two dates fall on the same UTC calendar day. */
function isSameDay(a: Date | null | undefined, b: Date): boolean {
  if (!a) return false
  const d = new Date(a)
  return d.getUTCFullYear() === b.getUTCFullYear() && d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() === b.getUTCDate()
}

/**
 * Grants the one-time per-tier welcome bonus (100 / 200 / 300) when a user
 * activates or changes to a subscription tier. Idempotent: each tier's bonus is
 * granted at most once. Reads the live tier from the subscription state so it
 * works without modifying the subscription routes.
 */
export async function ensureSignupBonus(userId: string): Promise<{ granted: number; plan: PlanId }> {
  const state = await getOrCreateSubState(userId)
  const plan = state.plan as PlanId
  const bonus = PLANS[plan].signupBonus
  const bal = await getOrCreateBalance(userId)

  if (bonus > 0 && !(bal.claimedSignupPlans as string[]).includes(plan)) {
    bal.claimedSignupPlans.push(plan)
    await bal.save()
    await recordTransaction({
      userId,
      amount: bonus,
      type: "bonus_signup",
      description: `Bonus di benvenuto ${plan}`,
    })
    return { granted: bonus, plan }
  }
  return { granted: 0, plan }
}

export interface DailyResult {
  granted: number
  alreadyClaimed: boolean
  plan: PlanId
  balance: number
  nextAvailableAt: Date
}

/**
 * Applies the daily platform-access reward (1 / 5 / 10) based on the current
 * tier. Prevents a second grant within the same UTC calendar day.
 */
export async function applyDailyReward(userId: string): Promise<DailyResult> {
  // Make sure the welcome bonus is settled for the current tier first.
  await ensureSignupBonus(userId)

  const state = await getOrCreateSubState(userId)
  const plan = state.plan as PlanId
  const daily = PLANS[plan].dailyCoins
  const bal = await getOrCreateBalance(userId)
  const now = new Date()

  const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

  if (isSameDay(bal.lastDailyAt, now)) {
    return { granted: 0, alreadyClaimed: true, plan, balance: bal.balance, nextAvailableAt: nextDay }
  }

  bal.lastDailyAt = now
  await bal.save()
  const res = await recordTransaction({
    userId,
    amount: daily,
    type: "daily_reward",
    description: `Ricompensa giornaliera ${plan}`,
  })

  return { granted: daily, alreadyClaimed: false, plan, balance: res.balance, nextAvailableAt: nextDay }
}

/* -------------------------------------------------------------------------- */
/* Consumption calculators (internal logic only — no real money involved).    */
/* -------------------------------------------------------------------------- */

/**
 * Collex Coin consumed to settle a trade. Uses the tier's coin-settlement share
 * (Base 90% / Gold 75% / Premium 55%) of the traded value. Premium also gets
 * the internal-fee discount applied on top.
 */
export function coinsForTrade(plan: PlanId, tradeValue: number): number {
  const base = Math.max(0, tradeValue) * PLANS[plan].tradeCoinsPct
  return Math.round(applyPremiumDiscount(plan, base).cost)
}

/**
 * Collex Coin consumed for a sale. Mirrors the tier's coin-settlement share of
 * the sale value, with the Premium discount applied.
 */
export function coinsForSale(plan: PlanId, saleValue: number): number {
  const base = Math.max(0, saleValue) * PLANS[plan].tradeCoinsPct
  return Math.round(applyPremiumDiscount(plan, base).cost)
}

/**
 * Applies the Premium internal-fee discount to a Collex Coin cost. Returns both
 * the discounted cost and the discount amount (0 for non-Premium tiers).
 */
export function applyPremiumDiscount(plan: PlanId, cost: number): { cost: number; discount: number } {
  if (plan !== "Premium") return { cost, discount: 0 }
  const discount = cost * PREMIUM_COIN_DISCOUNT
  return { cost: cost - discount, discount }
}

/* -------------------------------------------------------------------------- */
/* Admin authorization                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Authorizes admin-only Collex Coin operations. An operator is an admin if
 * their user id is listed in ADMIN_USER_IDS, or the request carries a valid
 * x-admin-secret header matching ADMIN_SECRET.
 */
export function isCollexAdmin(req: Request, userId: string): boolean {
  const allow = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (allow.includes(userId)) return true

  const secret = process.env.ADMIN_SECRET
  const header = req.headers.get("x-admin-secret")
  return Boolean(secret && header && header === secret)
}
