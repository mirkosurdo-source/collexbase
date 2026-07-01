import { Schema, models, model } from "mongoose"

export const COLLEX_TX_TYPES = [
  "bonus_signup",
  "daily_reward",
  "trade_fee",
  "sale_fee",
  "purchase_coins",
  "discount",
  "manual_adjustment",
  "spend",
  "auction_fine",
] as const

export type CollexTxType = (typeof COLLEX_TX_TYPES)[number]

/**
 * Append-only Collex Coin ledger entry. `amount` is signed: positive for
 * credits (bonuses, rewards, purchases) and negative for debits (fees, spends).
 */
const CollexCoinTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: COLLEX_TX_TYPES, required: true },
    description: { type: String, default: "", trim: true },
    balanceAfter: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
)

CollexCoinTransactionSchema.index({ userId: 1, createdAt: -1 })

const CollexCoinTransaction =
  models.CollexCoinTransaction || model("CollexCoinTransaction", CollexCoinTransactionSchema)

export default CollexCoinTransaction
