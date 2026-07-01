import { Schema, models, model } from "mongoose"

/**
 * Blocco 51 — append-only ledger of CreatorCredits movements. Positive deltas
 * are commission accruals; negative deltas are spends on internal features.
 */
const CreatorCreditsLedgerSchema = new Schema(
  {
    creatorId: { type: String, required: true, index: true },
    /** Signed amount: +earned, -spent. */
    delta: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    /** Balance after applying this delta (for fast statements). */
    balanceAfter: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

const CreatorCreditsLedger =
  models.CreatorCreditsLedger || model("CreatorCreditsLedger", CreatorCreditsLedgerSchema)

export default CreatorCreditsLedger
