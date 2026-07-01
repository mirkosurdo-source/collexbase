/**
 * Blocco 51 — Standard referral engine.
 *
 * Fully additive: rewards are paid through the canonical Wallet (the same store
 * the subscription signup bonus uses) via ordinary `reward` transactions. No
 * existing engine, ledger or Stripe flow is modified.
 */

import { connectDB } from "@/lib/db"
import { isValidObjectId } from "mongoose"
import User from "@/lib/models/User"
import ReferralEvent from "@/lib/models/ReferralEvent"
import { getOrCreateWallet } from "@/lib/wallet"
import { getCreatorByCode } from "@/lib/creator-affiliate"

/** CollexCoins granted to each side of a successful referral. */
export const REFERRAL_REWARD_COINS = 20

export type ReferralMethod = "link" | "qr" | "whatsapp"

/** Builds the public referral URL for an inviter. */
export function buildReferralLink(inviterId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "")
  return `${base}/register?ref=${encodeURIComponent(inviterId)}`
}

export interface ClaimResult {
  ok: boolean
  error?: string
  /** Coins granted to the invited user (the caller). */
  invitedReward?: number
  /** Invited user's new wallet coin balance. */
  invitedBalance?: number
}

/**
 * Records a referral and pays the +20/+20 reward. Called by the freshly
 * registered (invited) user, passing the inviter's referral code.
 *
 * Anti-abuse rules:
 *  - inviter must exist and differ from the invited user
 *  - an invited user can only ever be referred once (unique index + guard)
 *  - the invited account must be recent (no self-farming of aged accounts)
 */
export async function claimReferral(opts: {
  inviterCode: string
  invitedId: string
  method?: ReferralMethod
  ip?: string | null
}): Promise<ClaimResult> {
  const { inviterCode, invitedId, method = "link", ip = null } = opts
  await connectDB()

  const code = inviterCode.trim()
  if (!code || !isValidObjectId(invitedId)) {
    return { ok: false, error: "Codice referral non valido." }
  }

  // Resolve the code: a creator code (CR-XXXX) maps to its creatorId and tags
  // the event so commissions/discounts apply; otherwise it's a plain user id.
  let inviterId = code
  let creatorCode: string | null = null
  if (code.toUpperCase().startsWith("CR-")) {
    const partner = await getCreatorByCode(code)
    if (!partner || !partner.active) return { ok: false, error: "Codice creator non valido." }
    inviterId = String(partner.creatorId)
    creatorCode = partner.referralCode
  } else if (!isValidObjectId(inviterId)) {
    return { ok: false, error: "Codice referral non valido." }
  }

  if (inviterId === invitedId) {
    return { ok: false, error: "Non puoi invitare te stesso." }
  }

  const [inviter, invited] = await Promise.all([
    User.findById(inviterId).select("_id").lean(),
    User.findById(invitedId).select("_id createdAt").lean(),
  ])
  if (!inviter) return { ok: false, error: "Invitante inesistente." }
  if (!invited) return { ok: false, error: "Utente non trovato." }

  // The invited account must be new (claim window of 7 days) to limit abuse.
  const createdAt = new Date((invited as { createdAt?: Date }).createdAt ?? Date.now()).getTime()
  if (Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Periodo per il referral scaduto." }
  }

  // Block double-claims (a user can be referred only once).
  const existing = await ReferralEvent.findOne({ invitedId }).lean()
  if (existing) return { ok: false, error: "Referral già registrato per questo account." }

  let event
  try {
    event = await ReferralEvent.create({ inviterId, invitedId, method, ip, creatorCode, coinsRewarded: false })
  } catch {
    // Unique index race — treat as already claimed.
    return { ok: false, error: "Referral già registrato per questo account." }
  }

  // Pay both sides through the canonical wallet.
  const [inviterWallet, invitedWallet] = await Promise.all([
    getOrCreateWallet(inviterId),
    getOrCreateWallet(invitedId),
  ])

  inviterWallet.coins += REFERRAL_REWARD_COINS
  inviterWallet.transactions.push({
    type: "reward",
    currency: "coins",
    amount: REFERRAL_REWARD_COINS,
    description: "Bonus invito amico",
    status: "completed",
    createdAt: new Date(),
  })

  invitedWallet.coins += REFERRAL_REWARD_COINS
  invitedWallet.transactions.push({
    type: "reward",
    currency: "coins",
    amount: REFERRAL_REWARD_COINS,
    description: "Bonus registrazione tramite invito",
    status: "completed",
    createdAt: new Date(),
  })

  await Promise.all([inviterWallet.save(), invitedWallet.save()])

  event.coinsRewarded = true
  await event.save()

  return {
    ok: true,
    invitedReward: REFERRAL_REWARD_COINS,
    invitedBalance: invitedWallet.coins,
  }
}

export interface ReferralStats {
  totalInvites: number
  coinsEarned: number
  invited: { id: string; method: ReferralMethod; at: string }[]
}

/** Aggregates an inviter's referral performance. */
export async function getReferralStats(inviterId: string): Promise<ReferralStats> {
  await connectDB()
  const events = await ReferralEvent.find({ inviterId }).sort({ createdAt: -1 }).lean()

  const rewarded = events.filter((e) => (e as { coinsRewarded?: boolean }).coinsRewarded).length

  return {
    totalInvites: events.length,
    coinsEarned: rewarded * REFERRAL_REWARD_COINS,
    invited: events.map((e) => {
      const ev = e as { invitedId: string; method?: ReferralMethod; createdAt?: Date }
      return {
        id: String(ev.invitedId),
        method: (ev.method ?? "link") as ReferralMethod,
        at: new Date(ev.createdAt ?? Date.now()).toISOString(),
      }
    }),
  }
}
