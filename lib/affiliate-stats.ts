/**
 * Blocco 51 — affiliation badge metrics.
 *
 * Read-only aggregation over ReferralEvent and CreatorPartner. Fully additive:
 * no existing data is mutated.
 */

import { connectDB } from "@/lib/db"
import ReferralEvent from "@/lib/models/ReferralEvent"
import CreatorPartner from "@/lib/models/CreatorPartner"

export interface AffiliateBadgeRaw {
  /** Total successful invites made by the user (Ambassador). */
  referralInvites: number
  /** 1 if the user is (or has been) an activated Creator Partner, else 0. */
  creatorActivated: number
  /** Users invited through the user's creator code (Creator Partner tiers). */
  creatorUsersInvited: number
  /** Lifetime CreatorCredits earned (Revenue Maker). */
  creatorCreditsEarned: number
}

export async function gatherAffiliateBadgeRaw(userId: string): Promise<AffiliateBadgeRaw> {
  await connectDB()

  const partner = await CreatorPartner.findOne({ creatorId: userId })
    .select("referralCode totalCreditsEarned")
    .lean()

  const code = (partner as { referralCode?: string } | null)?.referralCode ?? null

  const [referralInvites, creatorUsersInvited] = await Promise.all([
    ReferralEvent.countDocuments({ inviterId: userId }),
    code ? ReferralEvent.countDocuments({ creatorCode: code }) : Promise.resolve(0),
  ])

  return {
    referralInvites,
    creatorActivated: partner ? 1 : 0,
    creatorUsersInvited,
    creatorCreditsEarned: Math.round((partner as { totalCreditsEarned?: number } | null)?.totalCreditsEarned ?? 0),
  }
}
