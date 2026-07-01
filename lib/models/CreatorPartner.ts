import { Schema, models, model } from "mongoose"

/**
 * Blocco 51 — Creator Pro partner. Activated by an admin only. Earns a
 * commission (default 10%) on what invited users spend, for a limited window
 * (default 6 months), credited as internal CreatorCredits (never real money).
 */
const CreatorPartnerSchema = new Schema(
  {
    creatorId: { type: String, required: true, unique: true, index: true },
    /** Public referral code used in creator links. */
    referralCode: { type: String, required: true, unique: true, index: true },
    /** Commission fraction on invited spend, e.g. 0.10. */
    commissionRate: { type: Number, default: 0.1 },
    /** Commission window in months from activation. */
    commissionDurationMonths: { type: Number, default: 6 },
    active: { type: Boolean, default: true, index: true },
    /**
     * Blocco 51 / 51.1 — the canonical balance is denominated in real euros
     * (commissionAmount = amountSpent * rate). Earned euros are spendable either
     * on internal features (spendCredits) or via cash payout (requestPayout).
     */
    /** Lifetime euros earned in commissions (never decremented). */
    totalCreditsEarned: { type: Number, default: 0 },
    /** Spendable euro balance (earned minus spent/reserved). "Creator Earnings". */
    creditsBalance: { type: Number, default: 0 },
    /** Euros locked in pending payout requests (not spendable). */
    pendingPayout: { type: Number, default: 0 },
    /** Lifetime euros actually paid out (approved payouts). */
    totalPaidOut: { type: Number, default: 0 },
    totalUsersInvited: { type: Number, default: 0 },
    activatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

const CreatorPartner = models.CreatorPartner || model("CreatorPartner", CreatorPartnerSchema)

export default CreatorPartner
