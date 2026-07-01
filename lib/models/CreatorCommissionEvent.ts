import { Schema, models, model } from "mongoose"

/**
 * Blocco 51 — one commission accrual: when an invited user spends, the creator
 * earns `commissionAmount` CreatorCredits. Read-only audit trail.
 */
const CreatorCommissionEventSchema = new Schema(
  {
    creatorId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    /** What the invited user spent (euros, informational only). */
    amountSpent: { type: Number, required: true },
    /** Credits awarded to the creator (= amountSpent * rate). */
    commissionAmount: { type: Number, required: true },
    /** Source of the spend: premium, gold, boost, etc. */
    source: { type: String, default: "premium", trim: true },
    /** Blocco 51.2 — euros discounted off the list price for this purchase. */
    discountApplied: { type: Number, default: 0 },
    creditedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

const CreatorCommissionEvent =
  models.CreatorCommissionEvent || model("CreatorCommissionEvent", CreatorCommissionEventSchema)

export default CreatorCommissionEvent
