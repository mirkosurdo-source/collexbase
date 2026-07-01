import { connectDB } from "@/lib/db"
import UserSubscriptionState from "@/lib/models/UserSubscriptionState"
import Subscription from "@/lib/models/Subscription"
import SubscriptionHistory from "@/lib/models/SubscriptionHistory"
import Wallet from "@/lib/models/Wallet"
import { getOrCreateWallet, type Badge } from "@/lib/wallet"

export type PlanId = "Base" | "Gold" | "Premium"
export type BillingCycle = "monthly" | "yearly"

export interface PlanPerks {
  id: PlanId
  name: string
  /** Price in euros. */
  monthlyPrice: number
  yearlyPrice: number
  /** Yearly saving vs paying monthly, in euros and percent. */
  yearlySaving: number
  yearlySavingPct: number
  /** AI valuations allowed per day. -1 means unlimited. */
  aiPerDay: number
  /** CollexCoins granted on daily platform access. */
  dailyCoins: number
  /** CollexCoins granted as the monthly bonus. */
  monthlyCoins: number
  /** One-time signup bonus in CollexCoins. */
  signupBonus: number
  /** Trade commission (fraction of traded value). */
  tradeFee: number
  /** Share of a trade that can be settled in coins (fraction). */
  tradeCoinsPct: number
  /** Marketplace sale commissions (fractions). */
  saleBuyerFee: number
  saleSellerFee: number
  /** Whether the plan grants a visible profile badge. */
  hasBadge: boolean
  /** Auction early-access level. */
  auctionEarlyAccess: "none" | "medium" | "total"
  /** Marketplace visibility priority. */
  priority: "standard" | "medium" | "high"
  /** Marketing bullet list shown on the pricing card. */
  highlights: string[]
}

/**
 * Canonical definition of the three subscription tiers, matching the
 * CollexBase pricing spec exactly. This module is the single source of
 * truth for plan perks across the subscription system.
 */
export const PLANS: Record<PlanId, PlanPerks> = {
  Base: {
    id: "Base",
    name: "Base",
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlySaving: 0,
    yearlySavingPct: 0,
    aiPerDay: 1,
    dailyCoins: 1,
    monthlyCoins: 50,
    signupBonus: 100,
    tradeFee: 0.05,
    tradeCoinsPct: 0.9,
    saleBuyerFee: 0.05,
    saleSellerFee: 0.02,
    hasBadge: false,
    auctionEarlyAccess: "none",
    priority: "standard",
    highlights: [
      "Gestione collezione",
      "Caricamento oggetti",
      "Profilo pubblico",
      "Marketplace, scambi e aste",
      "1 valutazione AI al giorno",
      "1 Collex Coin al giorno",
      "Commissioni scambi 5% · monete 90%",
      "Vendita: 5% buyer / 2% seller",
      "Bonus iscrizione: 100 Collex Coin",
    ],
  },
  Gold: {
    id: "Gold",
    name: "Gold",
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    yearlySaving: 19.89,
    yearlySavingPct: 16.6,
    aiPerDay: 10,
    dailyCoins: 5,
    monthlyCoins: 150,
    signupBonus: 200,
    tradeFee: 0.03,
    tradeCoinsPct: 0.75,
    saleBuyerFee: 0.03,
    saleSellerFee: 0.015,
    hasBadge: true,
    auctionEarlyAccess: "medium",
    priority: "medium",
    highlights: [
      "Tutti i vantaggi Base",
      "Più valutazioni AI (10 al giorno)",
      "Notifiche avanzate",
      "Statistiche collezione",
      "Badge Gold",
      "5 Collex Coins al giorno",
      "Accesso anticipato alle aste",
      "Commissioni scambi 3% · monete 75%",
      "Vendita: 3% buyer / 1,5% seller",
      "Profilo più visibile",
      "Bonus iscrizione: 200 Collex Coin",
    ],
  },
  Premium: {
    id: "Premium",
    name: "Premium",
    monthlyPrice: 19.99,
    yearlyPrice: 179.99,
    yearlySaving: 59.89,
    yearlySavingPct: 24.96,
    aiPerDay: -1,
    dailyCoins: 10,
    monthlyCoins: 300,
    signupBonus: 300,
    tradeFee: 0,
    tradeCoinsPct: 0.55,
    saleBuyerFee: 0,
    saleSellerFee: 0.01,
    hasBadge: true,
    auctionEarlyAccess: "total",
    priority: "high",
    highlights: [
      "Tutti i vantaggi Gold",
      "AI illimitata",
      "Analisi avanzate e consigli personalizzati",
      "Storico valore completo",
      "Badge Premium",
      "10 Collex Coins al giorno",
      "Priorità marketplace e aste esclusive",
      "Commissioni scambi 0% · monete 55%",
      "Vendita: 0% buyer / 1% seller",
      "Profilo in evidenza · supporto prioritario",
      "Sconti monete e funzioni esclusive",
      "Bonus iscrizione: 300 Collex Coin",
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ["Base", "Gold", "Premium"]

export function isPlanId(value: unknown): value is PlanId {
  return value === "Base" || value === "Gold" || value === "Premium"
}

export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan)
}

/** Price for a plan given the billing cycle. */
export function planPrice(plan: PlanId, cycle: BillingCycle): number {
  return cycle === "yearly" ? PLANS[plan].yearlyPrice : PLANS[plan].monthlyPrice
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Period length in ms for a billing cycle. */
export function periodMs(cycle: BillingCycle): number {
  return cycle === "yearly" ? 365 * DAY_MS : 30 * DAY_MS
}

type SubStateDoc = InstanceType<typeof UserSubscriptionState>

/** Returns the user's subscription state, creating a default Base state on first access. */
export async function getOrCreateSubState(userId: string): Promise<SubStateDoc> {
  await connectDB()
  let state = await UserSubscriptionState.findOne({ userId })
  if (!state) {
    state = await UserSubscriptionState.create({ userId, plan: "Base" })
  }
  return state
}

/** True if the AI day-counter needs resetting (new calendar day window). */
export function shouldResetAi(state: SubStateDoc): boolean {
  if (!state.aiResetAt) return true
  return Date.now() - new Date(state.aiResetAt).getTime() >= DAY_MS
}

export interface AiAvailability {
  unlimited: boolean
  limit: number
  used: number
  remaining: number
  resetAt: Date
}

/** Computes AI valuation availability for the day without consuming a credit. */
export function aiAvailability(state: SubStateDoc): AiAvailability {
  const limit = PLANS[state.plan as PlanId].aiPerDay
  const reset = shouldResetAi(state)
  const used = reset ? 0 : state.aiCreditsUsedToday
  const unlimited = limit === -1
  const resetAt = new Date((state.aiResetAt ? new Date(state.aiResetAt).getTime() : Date.now()) + DAY_MS)
  return {
    unlimited,
    limit,
    used,
    remaining: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, limit - used),
    resetAt,
  }
}

/**
 * Attempts to consume one AI valuation credit. Returns whether it was allowed
 * and persists the updated counter. Premium (unlimited) always allows.
 */
export async function consumeAiCredit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const state = await getOrCreateSubState(userId)
  const limit = PLANS[state.plan as PlanId].aiPerDay

  if (shouldResetAi(state)) {
    state.aiCreditsUsedToday = 0
    state.aiResetAt = new Date()
  }

  if (limit === -1) {
    state.aiCreditsUsedToday += 1
    await state.save()
    return { allowed: true, remaining: Number.POSITIVE_INFINITY }
  }

  if (state.aiCreditsUsedToday >= limit) {
    await state.save()
    return { allowed: false, remaining: 0 }
  }

  state.aiCreditsUsedToday += 1
  await state.save()
  return { allowed: true, remaining: Math.max(0, limit - state.aiCreditsUsedToday) }
}

/**
 * Syncs the wallet badge so existing reward and commission systems pick up the new tier.
 */
export async function syncWalletBadge(userId: string, plan: PlanId): Promise<void> {
  await Wallet.updateOne({ userId }, { $set: { badge: plan as Badge } })
}

export type PlanEvent = "signup" | "upgrade" | "downgrade" | "renew" | "cancel"

/**
 * Applies a subscription plan change end-to-end:
 * - updates UserSubscriptionState (plan + billing cycle)
 * - syncs the wallet badge (so existing fees/rewards follow the tier)
 * - upserts the active Subscription record with a new period
 * - grants the one-time per-tier signup bonus (first paid activation)
 * - logs a SubscriptionHistory entry
 *
 * Payments are placeholders in this block: `amount` is recorded but not charged.
 */
export async function applyPlanChange(opts: {
  userId: string
  toPlan: PlanId
  cycle: BillingCycle
  event: PlanEvent
}): Promise<{ grantedSignupBonus: number; price: number; periodEnd: Date }> {
  const { userId, toPlan, cycle, event } = opts
  const state = await getOrCreateSubState(userId)
  const fromPlan = state.plan as PlanId
  const price = planPrice(toPlan, cycle)
  const periodEnd = new Date(Date.now() + periodMs(cycle))

  // Update live state.
  state.plan = toPlan
  state.billingCycle = cycle

  // Grant the one-time signup/activation bonus the first time a tier's bonus is claimed.
  let grantedSignupBonus = 0
  const bonus = PLANS[toPlan].signupBonus
  if (!state.signupBonusClaimed && bonus > 0) {
    const wallet = await getOrCreateWallet(userId)
    wallet.coins += bonus
    wallet.transactions.push({
      type: "reward",
      currency: "coins",
      amount: bonus,
      description: `Bonus iscrizione ${toPlan}`,
      status: "completed",
      createdAt: new Date(),
    })
    await wallet.save()
    state.signupBonusClaimed = true
    state.signupBonusPlan = toPlan
    grantedSignupBonus = bonus
  }
  await state.save()

  // Keep wallet badge in sync with the plan tier.
  await syncWalletBadge(userId, toPlan)

  // Upsert the active subscription record.
  await Subscription.findOneAndUpdate(
    { userId },
    {
      userId,
      plan: toPlan,
      billingCycle: cycle,
      status: "active",
      price,
      autoRenew: true,
      currentPeriodEnd: periodEnd,
      ...(event === "signup" || event === "upgrade" ? { startedAt: new Date() } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Log the history event.
  await SubscriptionHistory.create({
    userId,
    event,
    fromPlan,
    toPlan,
    billingCycle: cycle,
    amount: price,
    note: `${event} ${fromPlan} → ${toPlan} (${cycle})`,
  })

  return { grantedSignupBonus, price, periodEnd }
}
